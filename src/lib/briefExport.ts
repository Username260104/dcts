import type jsPDF from 'jspdf';
import {
    buildStrategyGapDisplayModel,
    buildStrategyTranslationDisplayModel,
    type StrategyDisplayEntry,
    type StrategyDisplaySection,
    type StrategyDisplayTone,
} from '@/lib/strategyBriefPresenter';
import type { BriefOutput, LLMBriefResponse } from '@/types/ontology';

// --- Font cache ---
let fontBase64Cache: string | null = null;

async function loadKoreanFont(pdf: jsPDF): Promise<void> {
    if (!fontBase64Cache) {
        const response = await fetch('/fonts/NotoSansKR-Variable.ttf');
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        fontBase64Cache = btoa(binary);
    }

    pdf.addFileToVFS('NotoSansKR.ttf', fontBase64Cache);
    pdf.addFont('NotoSansKR.ttf', 'NotoSansKR', 'normal');
    pdf.addFont('NotoSansKR.ttf', 'NotoSansKR', 'bold');
}

// --- Layout constants ---
const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 25;
const MARGIN_BOTTOM = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const FONT_SIZE_TITLE = 14;
const FONT_SIZE_SECTION_TITLE = 11;
const FONT_SIZE_LABEL = 8;
const FONT_SIZE_BODY = 9;
const FONT_SIZE_SMALL = 8;

const LINE_HEIGHT = 1.6;
const SECTION_GAP = 10;
const PARAGRAPH_GAP = 4;

// --- Layout state ---
interface LayoutState {
    pdf: jsPDF;
    y: number;
}

function checkPageBreak(state: LayoutState, neededHeight: number): void {
    if (state.y + neededHeight > PAGE_HEIGHT - MARGIN_BOTTOM) {
        state.pdf.addPage();
        state.y = MARGIN_TOP;
    }
}

function getTextLines(pdf: jsPDF, text: string, maxWidth: number): string[] {
    return pdf.splitTextToSize(text, maxWidth) as string[];
}

function getLineHeight(fontSize: number): number {
    return fontSize * 0.3528 * LINE_HEIGHT; // pt to mm, then multiply by line height
}

// --- Drawing primitives ---

function addTitle(state: LayoutState, text: string): void {
    const { pdf } = state;
    const lh = getLineHeight(FONT_SIZE_TITLE);

    checkPageBreak(state, lh + 8);

    pdf.setFont('NotoSansKR', 'bold');
    pdf.setFontSize(FONT_SIZE_TITLE);
    pdf.setTextColor(17, 24, 39); // gray-900
    pdf.text(text, PAGE_WIDTH / 2, state.y, { align: 'center' });
    state.y += lh + 2;
}

function addSubtitle(state: LayoutState, text: string): void {
    const { pdf } = state;
    const lh = getLineHeight(FONT_SIZE_SMALL);

    pdf.setFont('NotoSansKR', 'normal');
    pdf.setFontSize(FONT_SIZE_SMALL);
    pdf.setTextColor(156, 163, 175); // gray-400
    pdf.text(text, PAGE_WIDTH / 2, state.y, { align: 'center' });
    state.y += lh + SECTION_GAP;
}

function addSectionTitle(state: LayoutState, title: string): void {
    const { pdf } = state;
    const lh = getLineHeight(FONT_SIZE_SECTION_TITLE);

    checkPageBreak(state, lh + 8);

    // Section title
    pdf.setFont('NotoSansKR', 'bold');
    pdf.setFontSize(FONT_SIZE_SECTION_TITLE);
    pdf.setTextColor(17, 24, 39);
    pdf.text(title, MARGIN_LEFT, state.y);
    state.y += lh + 1;

    // Underline
    pdf.setDrawColor(229, 231, 235); // gray-200
    pdf.setLineWidth(0.3);
    pdf.line(MARGIN_LEFT, state.y, MARGIN_LEFT + CONTENT_WIDTH, state.y);
    state.y += 4;
}

function addParagraph(state: LayoutState, text: string, options?: {
    fontSize?: number;
    color?: [number, number, number];
    indent?: number;
    fontStyle?: 'normal' | 'bold';
}): void {
    const { pdf } = state;
    const fontSize = options?.fontSize ?? FONT_SIZE_BODY;
    const color = options?.color ?? [31, 41, 55]; // gray-800
    const indent = options?.indent ?? 0;
    const fontStyle = options?.fontStyle ?? 'normal';
    const lh = getLineHeight(fontSize);
    const maxWidth = CONTENT_WIDTH - indent;

    pdf.setFont('NotoSansKR', fontStyle);
    pdf.setFontSize(fontSize);
    pdf.setTextColor(...color);

    const lines = getTextLines(pdf, text, maxWidth);

    for (const line of lines) {
        checkPageBreak(state, lh);
        pdf.text(line, MARGIN_LEFT + indent, state.y);
        state.y += lh;
    }
    state.y += PARAGRAPH_GAP;
}

function addBlockquote(state: LayoutState, text: string): void {
    const { pdf } = state;
    const fontSize = FONT_SIZE_BODY;
    const lh = getLineHeight(fontSize);
    const indent = 6;
    const maxWidth = CONTENT_WIDTH - indent;

    pdf.setFont('NotoSansKR', 'normal');
    pdf.setFontSize(fontSize);
    pdf.setTextColor(55, 65, 81); // gray-700

    const quoted = `\u201C${text}\u201D`;
    const lines = getTextLines(pdf, quoted, maxWidth);

    // Draw left border for all lines
    const totalHeight = lines.length * lh;
    checkPageBreak(state, totalHeight);

    const startY = state.y;
    for (const line of lines) {
        checkPageBreak(state, lh);
        pdf.text(line, MARGIN_LEFT + indent, state.y);
        state.y += lh;
    }

    // Draw the left bar
    pdf.setDrawColor(209, 213, 219); // gray-300
    pdf.setLineWidth(1);
    pdf.line(MARGIN_LEFT + 2, startY - lh + 1, MARGIN_LEFT + 2, state.y - lh + 1);
    state.y += PARAGRAPH_GAP;
}

function addLabel(state: LayoutState, label: string, color?: [number, number, number]): void {
    const { pdf } = state;
    const lh = getLineHeight(FONT_SIZE_LABEL);

    checkPageBreak(state, lh + getLineHeight(FONT_SIZE_BODY));

    pdf.setFont('NotoSansKR', 'bold');
    pdf.setFontSize(FONT_SIZE_LABEL);
    pdf.setTextColor(...(color ?? [107, 114, 128])); // gray-500
    pdf.text(label, MARGIN_LEFT, state.y);
    state.y += lh + 1;
}

function addLabeledBlock(
    state: LayoutState,
    label: string,
    value?: string,
    color?: [number, number, number]
): void {
    if (!value) return;
    addLabel(state, label, color);
    addParagraph(state, value);
}

function addHighlightedBlock(state: LayoutState, label: string, text: string, colors: {
    labelColor: [number, number, number];
    textColor: [number, number, number];
    bgColor: [number, number, number];
}): void {
    const { pdf } = state;
    const labelLh = getLineHeight(FONT_SIZE_LABEL);
    const bodyLh = getLineHeight(FONT_SIZE_BODY);
    const maxWidth = CONTENT_WIDTH - 8;

    pdf.setFont('NotoSansKR', 'normal');
    pdf.setFontSize(FONT_SIZE_BODY);
    const lines = getTextLines(pdf, text, maxWidth);
    const blockHeight = labelLh + 2 + lines.length * bodyLh + 6;

    checkPageBreak(state, blockHeight);

    // Background
    pdf.setFillColor(...colors.bgColor);
    pdf.roundedRect(MARGIN_LEFT, state.y - 3, CONTENT_WIDTH, blockHeight, 2, 2, 'F');

    // Label
    state.y += 1;
    pdf.setFont('NotoSansKR', 'bold');
    pdf.setFontSize(FONT_SIZE_LABEL);
    pdf.setTextColor(...colors.labelColor);
    pdf.text(label, MARGIN_LEFT + 4, state.y);
    state.y += labelLh + 1;

    // Text
    pdf.setFont('NotoSansKR', 'normal');
    pdf.setFontSize(FONT_SIZE_BODY);
    pdf.setTextColor(...colors.textColor);
    for (const line of lines) {
        pdf.text(line, MARGIN_LEFT + 4, state.y);
        state.y += bodyLh;
    }
    state.y += PARAGRAPH_GAP + 2;
}

function addBulletList(state: LayoutState, items: string[], options?: {
    color?: [number, number, number];
    bulletChar?: string;
}): void {
    const { pdf } = state;
    const lh = getLineHeight(FONT_SIZE_BODY);
    const color = options?.color ?? [31, 41, 55];
    const bullet = options?.bulletChar ?? '\u2022';
    const indent = 5;
    const maxWidth = CONTENT_WIDTH - indent;

    pdf.setFont('NotoSansKR', 'normal');
    pdf.setFontSize(FONT_SIZE_BODY);

    for (const item of items) {
        pdf.setTextColor(...color);
        const lines = getTextLines(pdf, item, maxWidth);
        const itemHeight = lines.length * lh + 2;
        checkPageBreak(state, itemHeight);

        // Bullet
        pdf.text(bullet, MARGIN_LEFT + 1, state.y);

        // Text
        for (let i = 0; i < lines.length; i++) {
            pdf.text(lines[i], MARGIN_LEFT + indent, state.y);
            state.y += lh;
        }
        state.y += 1;
    }
    state.y += PARAGRAPH_GAP;
}

function addLabeledList(
    state: LayoutState,
    label: string,
    values?: string[],
    color?: [number, number, number]
): void {
    if (!values || values.length === 0) return;
    addLabel(state, label, color);
    addBulletList(state, values, {
        color: color ?? [31, 41, 55],
    });
}

function addTokenGrid(state: LayoutState, tokens: Array<{ label: string; value: string }>): void {
    const { pdf } = state;
    const colWidth = (CONTENT_WIDTH - 4) / 2;
    const labelLh = getLineHeight(FONT_SIZE_LABEL);
    const bodyLh = getLineHeight(FONT_SIZE_BODY);

    for (let i = 0; i < tokens.length; i += 2) {
        const left = tokens[i];
        const right = tokens[i + 1];

        // Calculate height needed
        pdf.setFontSize(FONT_SIZE_BODY);
        const leftLines = getTextLines(pdf, left.value, colWidth - 8);
        const rightLines = right ? getTextLines(pdf, right.value, colWidth - 8) : [];
        const maxLines = Math.max(leftLines.length, rightLines.length);
        const rowHeight = labelLh + 2 + maxLines * bodyLh + 6;

        checkPageBreak(state, rowHeight);

        const rowY = state.y;

        // Left card
        drawTokenCard(pdf, MARGIN_LEFT, rowY, colWidth, rowHeight, left.label, leftLines);

        // Right card
        if (right) {
            drawTokenCard(pdf, MARGIN_LEFT + colWidth + 4, rowY, colWidth, rowHeight, right.label, rightLines);
        }

        state.y = rowY + rowHeight + 2;
    }
    state.y += PARAGRAPH_GAP;
}

function drawTokenCard(
    pdf: jsPDF,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    valueLines: string[],
): void {
    const labelLh = getLineHeight(FONT_SIZE_LABEL);
    const bodyLh = getLineHeight(FONT_SIZE_BODY);

    // Background
    pdf.setFillColor(249, 250, 251); // gray-50
    pdf.roundedRect(x, y - 3, width, height, 2, 2, 'F');

    // Label
    pdf.setFont('NotoSansKR', 'normal');
    pdf.setFontSize(FONT_SIZE_LABEL);
    pdf.setTextColor(107, 114, 128);
    pdf.text(label, x + 4, y + 1);

    // Value
    pdf.setFont('NotoSansKR', 'normal');
    pdf.setFontSize(FONT_SIZE_BODY);
    pdf.setTextColor(17, 24, 39);
    let lineY = y + 1 + labelLh + 1;
    for (const line of valueLines) {
        pdf.text(line, x + 4, lineY);
        lineY += bodyLh;
    }
}

function addPillTags(state: LayoutState, items: string[], options?: {
    color?: [number, number, number];
    bgColor?: [number, number, number];
    strikethrough?: boolean;
}): void {
    const { pdf } = state;
    const fontSize = FONT_SIZE_SMALL;
    const lh = getLineHeight(fontSize);
    const color = options?.color ?? [55, 65, 81];
    const bgColor = options?.bgColor ?? [243, 244, 246];
    const pillHeight = lh + 3;
    const gap = 3;

    pdf.setFont('NotoSansKR', 'normal');
    pdf.setFontSize(fontSize);

    let x = MARGIN_LEFT;
    let rowStartY = state.y;

    for (const item of items) {
        const textWidth = pdf.getTextWidth(item);
        const pillWidth = textWidth + 8;

        // Wrap to next line if needed
        if (x + pillWidth > MARGIN_LEFT + CONTENT_WIDTH && x > MARGIN_LEFT) {
            x = MARGIN_LEFT;
            rowStartY += pillHeight + 2;
            state.y = rowStartY;
        }

        checkPageBreak(state, pillHeight);

        // Pill background
        pdf.setFillColor(...bgColor);
        pdf.roundedRect(x, state.y - lh, pillWidth, pillHeight, pillHeight / 2, pillHeight / 2, 'F');

        // Text
        pdf.setTextColor(...color);
        pdf.text(item, x + 4, state.y);

        // Strikethrough
        if (options?.strikethrough) {
            const textY = state.y - lh / 4;
            pdf.setDrawColor(...color);
            pdf.setLineWidth(0.3);
            pdf.line(x + 4, textY, x + 4 + textWidth, textY);
        }

        x += pillWidth + gap;
    }

    state.y = rowStartY + pillHeight + PARAGRAPH_GAP;
}

function addDecisionTrail(state: LayoutState, trail: NonNullable<BriefOutput['decisionTrail']>): void {
    for (let i = 0; i < trail.length; i++) {
        const step = trail[i];
        const stepLabel = `Q${i + 1}. ${step.question}`;

        addParagraph(state, stepLabel, {
            fontSize: FONT_SIZE_BODY,
            fontStyle: 'bold',
            color: [55, 65, 81],
        });

        addParagraph(state, `\u2192 ${step.selectedOption}`, {
            fontSize: FONT_SIZE_BODY,
            color: [17, 24, 39],
            indent: 4,
        });

        if (step.nextReason) {
            addParagraph(state, step.nextReason, {
                fontSize: FONT_SIZE_SMALL,
                color: [107, 114, 128],
                indent: 4,
            });
        }
    }
}

function formatSectionTitle(index: number, title: string): string {
    return `${String.fromCharCode(65 + index)}. ${title}`;
}

function getToneColors(tone: StrategyDisplayTone = 'default'): {
    label: [number, number, number];
    body: [number, number, number];
} {
    switch (tone) {
        case 'success':
            return {
                label: [4, 120, 87],
                body: [6, 95, 70],
            };
        case 'warning':
            return {
                label: [180, 83, 9],
                body: [146, 64, 14],
            };
        case 'danger':
            return {
                label: [185, 28, 28],
                body: [127, 29, 29],
            };
        case 'muted':
            return {
                label: [100, 116, 139],
                body: [71, 85, 105],
            };
        default:
            return {
                label: [107, 114, 128],
                body: [31, 41, 55],
            };
    }
}

function addStrategyDisplayEntry(state: LayoutState, entry: StrategyDisplayEntry): void {
    const colors = getToneColors(entry.tone);

    if (entry.kind === 'text') {
        addLabeledBlock(state, entry.label, entry.value, colors.label);
        return;
    }

    addLabeledList(state, entry.label, entry.values, colors.label);
}

function addStrategyDisplaySection(state: LayoutState, title: string, section: StrategyDisplaySection): void {
    addSectionTitle(state, title);

    if (section.description) {
        addParagraph(state, section.description);
    }

    for (const entry of section.entries) {
        addStrategyDisplayEntry(state, entry);
    }

    state.y += SECTION_GAP;
}

// --- Brief type renderers ---

function getBriefTitle(briefKind: string): string {
    if (briefKind === 'translation_brief') return '\uC804\uB7B5-\uB514\uC790\uC778 \uBC88\uC5ED \uBE0C\uB9AC\uD504';
    if (briefKind === 'gap_memo') return '\uC804\uB7B5 \uC815\uB82C \uAC2D \uBA54\uBAA8';
    return '\uB514\uC790\uC778 \uCEE4\uBBA4\uB2C8\uCF00\uC774\uC158 \uBE0C\uB9AC\uD504';
}

function renderInterpretationBrief(state: LayoutState, brief: BriefOutput, llmSummary: LLMBriefResponse | null): void {
    // A. Original Feedback
    addSectionTitle(state, 'A. \uC6D0\uBB38 \uD53C\uB4DC\uBC31');
    addBlockquote(state, brief.originalFeedback);
    state.y += SECTION_GAP;

    // B. Interpretation Summary
    addSectionTitle(state, 'B. \uD574\uC11D \uC694\uC57D');
    if (brief.clientSummary) {
        addParagraph(state, brief.clientSummary);
    }
    if (brief.clientAntiSummary) {
        addParagraph(state, brief.clientAntiSummary, {
            fontSize: FONT_SIZE_SMALL,
            color: [107, 114, 128],
        });
    }
    state.y += SECTION_GAP;

    // C. Strategy Interpretation
    addSectionTitle(state, 'C. \uC804\uB7B5 \uD574\uC11D');
    if (brief.strategySummary) {
        addLabeledBlock(state, '\uBC29\uD5A5 \uC694\uC57D', brief.strategySummary);
    }
    if (brief.strategyPositioningContext) {
        addHighlightedBlock(state, '\uD3EC\uC9C0\uC154\uB2DD \uB9E5\uB77D', brief.strategyPositioningContext, {
            labelColor: [124, 58, 237],  // purple-600
            textColor: [91, 33, 182],    // purple-800 approx
            bgColor: [245, 243, 255],    // purple-50
        });
    }
    if (brief.strategyPersuasionGuide) {
        addHighlightedBlock(state, '\uC124\uBA85 \uD3EC\uC778\uD2B8', brief.strategyPersuasionGuide, {
            labelColor: [79, 70, 229],   // indigo-600
            textColor: [55, 48, 163],    // indigo-800 approx
            bgColor: [238, 242, 255],    // indigo-50
        });
    }
    state.y += SECTION_GAP;

    // D. Designer Interpretation
    if (brief.primaryBranch) {
        addSectionTitle(state, 'D. \uB514\uC790\uC774\uB108 \uD574\uC11D');

        // Primary branch
        addParagraph(state, `[\uD655\uC815] ${brief.primaryBranch.branchLabel} (${brief.primaryBranch.branchId})`, {
            fontStyle: 'bold',
            color: [17, 24, 39],
        });
        addParagraph(state, brief.primaryBranch.descriptionDesigner);

        // Secondary branch
        if (brief.secondaryBranch) {
            addParagraph(state, `[\uCC38\uACE0] ${brief.secondaryBranch.branchLabel}`, {
                fontStyle: 'bold',
                color: [55, 65, 81],
            });
            addParagraph(state, brief.secondaryBranch.descriptionDesigner, {
                color: [75, 85, 99],
            });
        }

        // AI rationale
        if (llmSummary?.designerSummary) {
            addHighlightedBlock(state, 'AI \uD574\uC11D \uADFC\uAC70', llmSummary.designerSummary, {
                labelColor: [37, 99, 235],
                textColor: [30, 64, 175],
                bgColor: [239, 246, 255],
            });
        }

        if (brief.interpretationRationale) {
            addParagraph(state, brief.interpretationRationale, {
                fontSize: FONT_SIZE_SMALL,
                color: [107, 114, 128],
            });
        }
        state.y += SECTION_GAP;
    }

    // E. Design Tokens
    if (brief.designTokens) {
        addSectionTitle(state, 'E. \uC870\uC815 \uD78C\uD2B8');
        addTokenGrid(state, [
            { label: '\uCEEC\uB7EC', value: brief.designTokens.colorDirection },
            { label: '\uD0C0\uC774\uD3EC\uADF8\uB798\uD53C', value: brief.designTokens.typographyDirection },
            { label: '\uB808\uC774\uC544\uC6C3', value: brief.designTokens.layoutDirection },
            { label: '\uC774\uBBF8\uC9C0', value: brief.designTokens.imageDirection },
            { label: '\uD14D\uC2A4\uCC98', value: brief.designTokens.textureDirection },
        ]);

        if (llmSummary?.adjustmentNotes) {
            addHighlightedBlock(state, '\uB9E5\uB77D \uBC18\uC601 \uBA54\uBAA8', llmSummary.adjustmentNotes, {
                labelColor: [22, 163, 74],
                textColor: [21, 128, 61],
                bgColor: [240, 253, 244],
            });
        }
        state.y += SECTION_GAP;
    }

    // F. Never Do List
    if (brief.neverDoList?.length) {
        addSectionTitle(state, 'F. \uD53C\uD574\uC57C \uD560 \uAC83');
        addBulletList(state, brief.neverDoList, { color: [185, 28, 28] }); // red-700

        if (brief.confusionWarnings?.length) {
            for (const warning of brief.confusionWarnings) {
                addHighlightedBlock(state, '\u26A0', warning, {
                    labelColor: [180, 83, 9],
                    textColor: [180, 83, 9],
                    bgColor: [255, 251, 235],
                });
            }
        }
        state.y += SECTION_GAP;
    }

    // G. References
    if (brief.references?.length) {
        addSectionTitle(state, 'G. \uB808\uD37C\uB7F0\uC2A4 \uBC29\uD5A5');
        addLabel(state, '\uCC38\uACE0 \uB808\uD37C\uB7F0\uC2A4');
        addPillTags(state, brief.references);

        if (brief.antiReferences?.length) {
            addLabel(state, '\uD53C\uD574\uC57C \uD560 \uB808\uD37C\uB7F0\uC2A4');
            addPillTags(state, brief.antiReferences, {
                color: [220, 38, 38],
                bgColor: [254, 242, 242],
                strikethrough: true,
            });
        }
        state.y += SECTION_GAP;
    }

    // H. Decision Trail
    if (brief.decisionTrail?.length) {
        addSectionTitle(state, 'H. \uC120\uD0DD \uD750\uB984');
        addDecisionTrail(state, brief.decisionTrail);
    }
}

function renderStrategyTranslationBrief(state: LayoutState, brief: BriefOutput): void {
    const model = buildStrategyTranslationDisplayModel(brief);
    if (!model) return;

    // A. Strategy Input
    addSectionTitle(state, 'A. \uC804\uB7B5 \uC785\uB825 \uC6D0\uBB38');
    addBlockquote(state, brief.originalFeedback);
    state.y += SECTION_GAP;

    for (let i = 0; i < model.sections.length; i += 1) {
        addStrategyDisplaySection(
            state,
            formatSectionTitle(i + 1, model.sections[i].title),
            model.sections[i]
        );
    }

    if (brief.decisionTrail?.length) {
        addSectionTitle(state, formatSectionTitle(model.sections.length + 1, '\uC120\uD0DD \uD750\uB984'));
        addDecisionTrail(state, brief.decisionTrail);
    }
}

function renderStrategyGapBrief(state: LayoutState, brief: BriefOutput): void {
    const model = buildStrategyGapDisplayModel(brief);
    if (!model) return;

    // A. Strategy Input
    addSectionTitle(state, 'A. \uC804\uB7B5 \uC785\uB825 \uC6D0\uBB38');
    addBlockquote(state, brief.originalFeedback);
    state.y += SECTION_GAP;

    for (let i = 0; i < model.sections.length; i += 1) {
        addStrategyDisplaySection(
            state,
            formatSectionTitle(i + 1, model.sections[i].title),
            model.sections[i]
        );
    }

    if (brief.decisionTrail?.length) {
        addSectionTitle(state, formatSectionTitle(model.sections.length + 1, '\uC120\uD0DD \uD750\uB984'));
        addDecisionTrail(state, brief.decisionTrail);
    }
}

// --- Main export function ---

export async function exportBriefToPdf(
    brief: BriefOutput,
    llmSummary: LLMBriefResponse | null,
    filename: string,
): Promise<void> {
    const { default: jsPDF } = await import('jspdf');

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    await loadKoreanFont(pdf);
    pdf.setFont('NotoSansKR', 'normal');

    const state: LayoutState = { pdf, y: MARGIN_TOP };

    // Title
    addTitle(state, getBriefTitle(brief.briefKind));
    addSubtitle(state, `\uC0DD\uC131\uC77C ${new Date(brief.generatedAt).toLocaleDateString('ko-KR')}`);

    // Render appropriate brief type
    if (brief.briefKind === 'translation_brief' && brief.strategyTranslation) {
        renderStrategyTranslationBrief(state, brief);
    } else if (brief.briefKind === 'gap_memo' && brief.gapMemo) {
        renderStrategyGapBrief(state, brief);
    } else {
        renderInterpretationBrief(state, brief, llmSummary);
    }

    // Footer on every page
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFont('NotoSansKR', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(156, 163, 175);
        pdf.text(`Lens (DCTS) \u2014 ${i} / ${pageCount}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 10, { align: 'center' });
    }

    pdf.save(filename);
}
