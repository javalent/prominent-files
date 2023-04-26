import {
    Notice,
    Plugin,
    setIcon,
    TAbstractFile,
    View,
    WorkspaceLeaf
} from "obsidian";
import { around } from "monkey-around";

interface InternalPlugin {
    enabled: boolean;
    enable: (b: boolean) => void;
    disable: (b: boolean) => void;
}
interface Starred extends InternalPlugin {
    instance: {
        addItem: (file: StarredFile) => void;
        removeItem: (file: StarredFile) => void;
        items: StarredFile[];
    };
}
interface FileExplorer extends InternalPlugin {}

interface StarredFile {
    type: "file" | "folder";
    path: string;
}
interface InternalPlugins {
    starred: Starred;
    bookmarks: Starred;
    "file-explorer": FileExplorer;
}

declare module "obsidian" {
    interface App {
        internalPlugins: {
            plugins: InternalPlugins;
            getPluginById<T extends keyof InternalPlugins>(
                id: T
            ): InternalPlugins[T];
            loadPlugin(...args: any[]): any;
        };
    }
    interface TAbstractFile {
        titleEl: HTMLElement;
    }
}
interface FileExplorerWorkspaceLeaf extends WorkspaceLeaf {
    containerEl: HTMLElement;
    view: FileExplorerView;
}

interface FileExplorerView extends View {
    fileItems: { [path: string]: TAbstractFile };
}

export default class ProminentStarredFiles extends Plugin {
    bookmarkHandler: () => void;
    files: Set<string> = new Set();
    get bookmarksEnabled() {
        return this.app.internalPlugins.getPluginById("bookmarks").enabled;
    }
    get bookmarks() {
        return this.app.internalPlugins.getPluginById("bookmarks");
    }
    get bookmarkInstance() {
        if (!this.bookmarksEnabled) return;
        return this.bookmarks.instance;
    }
    get fileExplorers() {
        return this.app.workspace.getLeavesOfType(
            "file-explorer"
        ) as FileExplorerWorkspaceLeaf[];
    }
    async onload() {
        console.log("Prominent Starred Files plugin loaded");

        this.app.workspace.onLayoutReady(() => this.checkAndEnable());
    }
    checkAndEnable() {
        setTimeout(() => {
            const self = this;
            if (
                !this.app.internalPlugins.getPluginById("file-explorer").enabled
            ) {
                new Notice(
                    "The File Explorer core plugin must be enabled to use this plugin."
                );

                const explorer = around(
                    this.app.internalPlugins.getPluginById("file-explorer"),
                    {
                        enable: function (next) {
                            return function (b) {
                                const apply = next.call(this, b);
                                explorer();
                                self.checkAndEnable();
                                return apply;
                            };
                        },
                        disable: function (next) {
                            return function (b) {
                                explorer();
                                self.checkAndEnable();
                                return next.call(this, b);
                            };
                        }
                    }
                );
                this.register(explorer);
                return;
            }

            this.register(
                around(this.bookmarks, {
                    enable: function (next) {
                        return function (b) {
                            const apply = next.call(this, b);
                            self.registerHandlers();
                            for (let item of self.bookmarkInstance?.items ??
                                []) {
                                self.setIcon(item, "bookmark");
                            }
                            return apply;
                        };
                    },
                    disable: function (next) {
                        return function (b) {
                            self.bookmarkHandler();
                            self.registerHandlers();
                            for (let item of self.bookmarkInstance?.items ??
                                []) {
                                self.removeIcon(item);
                            }
                            return next.call(this, b);
                        };
                    }
                })
            );
            if (!this.bookmarksEnabled) {
                new Notice(
                    "The Bookmarks core plugin must be enabled to use this plugin."
                );
            } else {
                this.registerHandlers();
            }
        });
    }
    registerHandlers() {
        const self = this;

        if (this.bookmarksEnabled) {
            for (let item of this.bookmarkInstance?.items ?? []) {
                this.setIcon(item, "bookmark");
            }

            this.bookmarkHandler = around(this.bookmarks.instance, {
                addItem: function (next) {
                    return function (file) {
                        self.setIcon(file, "bookmark");
                        return next.call(this, file);
                    };
                },
                removeItem: function (next) {
                    return function (file) {
                        self.removeIcon(file);
                        return next.call(this, file);
                    };
                }
            });
            this.register(this.bookmarkHandler);
        }
    }
    setIcon(
        file: StarredFile,
        icon: "star-glyph" | "bookmark",
        el?: HTMLElement
    ) {
        if (!this.fileExplorers.length) return;
        if (this.files.has(file.path)) return;

        for (let explorer of this.fileExplorers) {
            const element =
                el ??
                explorer.view?.fileItems?.[file.path]?.titleEl ??
                explorer.containerEl.querySelector(
                    `.nav-${file.type}-title[data-path="${file.path}"]`
                );
            if (!element) continue;

            this.files.add(file.path);

            setIcon(element.createDiv("prominent-decorated-file"), icon);
        }
    }
    removeIcon(file: StarredFile) {
        if (!this.fileExplorers.length) return;

        for (let explorer of this.fileExplorers) {
            const element = explorer.containerEl.querySelector(
                `.nav-${file.type}-title[data-path="${file.path}"]`
            );
            if (!element) continue;
            this.files.delete(file.path);

            const stars = element.querySelectorAll(".prominent-decorated-file");
            if (stars.length) stars.forEach((star) => star.detach());
        }
    }
    onunload() {
        console.log("Prominent Files plugin unloaded");
        for (let file of this.bookmarkInstance?.items ?? []) {
            this.removeIcon(file);
        }
    }
}
