declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
    const workerModule: {
        WorkerMessageHandler?: unknown;
    };

    export default workerModule;
    export const WorkerMessageHandler: unknown;
}
