export async function exportBriefToPdf(elementId: string, filename: string): Promise<void> {
    const element = document.getElementById(elementId);

    if (!element) {
        throw new Error('PDF로 저장할 브리프 영역을 찾을 수 없습니다.');
    }

    const html2pdf = (await import('html2pdf.js')).default;

    await html2pdf()
        .set({
            margin: 10,
            filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(element)
        .save();
}
