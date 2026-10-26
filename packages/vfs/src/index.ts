import { dbDeleteFile, dbListFiles, dbReadFile, dbWriteFile } from "./storage";

export const vfsManager = {
    async writeFile(path: string, content: string): Promise<void> {
        const cleanPath = path.startsWith("/") ? path : `/${path}`;
        await dbWriteFile(cleanPath, content);
    },

    async readFile(path: string): Promise<string | null> {
        const cleanPath = path.startsWith("/") ? path : `/${path}`;
        return await dbReadFile(cleanPath);
    },

    async listFiles(): Promise<string[]> {
        return await dbListFiles();
    },

    async deleteFile(path: string): Promise<void> {
        const cleanPath = path.startsWith("/") ? path : `/${path}`;
        await dbDeleteFile(cleanPath);
    },
};
