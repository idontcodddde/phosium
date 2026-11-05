import {
    dbDeleteNode,
    dbGetNode,
    dbListNodes,
    dbPutNode,
    VFSNode,
} from "./storage";

export const vfsManager = {
    async writeFile(path: string, content: string): Promise<void> {
        const cleanPath = path.startsWith("/") ? path : `/${path}`;
        await dbPutNode({
            path: cleanPath,
            type: "file",
            content,
            updatedAt: Date.now(),
        });
    },

    async createDirectory(path: string): Promise<void> {
        const cleanPath = path.endsWith("/") ? path.slice(0, -1) : path;
        const finalPath = cleanPath.startsWith("/")
            ? cleanPath
            : `/${cleanPath}`;
        await dbPutNode({
            path: finalPath,
            type: "directory",
            updatedAt: Date.now(),
        });
    },

    async readFile(path: string): Promise<string | null> {
        const cleanPath = path.startsWith("/") ? path : `/${path}`;
        const node = await dbGetNode(cleanPath);
        return node && node.type === "file" ? node.content ?? "" : null;
    },

    async listNodes(): Promise<VFSNode[]> {
        return await dbListNodes();
    },

    async listFiles(): Promise<string[]> {
        const nodes = await dbListNodes();
        return nodes.filter((n) => n.type === "file").map((n) => n.path);
    },

    async deleteFile(path: string): Promise<void> {
        const cleanPath = path.startsWith("/") ? path : `/${path}`;
        await dbDeleteNode(cleanPath);
    },
};
