'use client';

import { useSessionStore } from '@/store/sessionStore';
import RoleStep from './steps/RoleStep';
import EntryStep from './steps/EntryStep';
import ContextStep from './steps/ContextStep';
import QuestionsStep from './steps/QuestionsStep';
import ConfirmStep from './steps/ConfirmStep';
import BriefStep from './steps/BriefStep';

export default function StepContainer() {
    const step = useSessionStore((s) => s.step);

    switch (step) {
        case 'role':
            return <RoleStep />;
        case 'entry':
            return <EntryStep />;
        case 'context':
            return <ContextStep />;
        case 'questions':
            return <QuestionsStep />;
        case 'confirm':
            return <ConfirmStep />;
        case 'brief':
            return <BriefStep />;
        default:
            return <RoleStep />;
    }
}
