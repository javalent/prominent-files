import {
    Notice,
    Plugin,
    setIcon,
    TAbstractFile,
    View,
    WorkspaceLeaf
} from "obsidian";
import { around } from "monkey-around";

import "./main.css";

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
    type: "file";
    title: string;
    path: string;
}
interface InternalPlugins {
    starred: Starred;
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
    handler: () => void;
    files: Set<string> = new Set();
    get enabled() {
        return this.app.internalPlugins.getPluginById("starred").enabled;
    }
    get starred() {
        return this.app.internalPlugins.getPluginById("starred");
    }
    get instance() {
        if (!this.enabled) return;
        return this.starred.instance;
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
                around(this.starred, {
                    enable: function (next) {
                        return function (b) {
                            const apply = next.call(this, b);
                            self.registerHandlers();
                            for (let item of self.instance?.items ?? []) {
                                self.applyStar(item);
                            }
                            return apply;
                        };
                    },
                    disable: function (next) {
                        return function (b) {
                            self.handler();
                            for (let item of self.instance?.items ?? []) {
                                self.removeStar(item);
                            }
                            return next.call(this, b);
                        };
                    }
                })
            );
            if (!this.enabled) {
                new Notice(
                    "The Starred core plugin must be enabled to use this plugin."
                );
            } else {
                this.registerHandlers();
            }
        });
    }
    registerHandlers() {
        const self = this;
        for (let item of this.instance?.items ?? []) {
            this.applyStar(item);
        }

        this.handler = around(this.starred.instance, {
            addItem: function (next) {
                return function (file) {
                    self.applyStar(file);
                    return next.call(this, file);
                };
            },
            removeItem: function (next) {
                return function (file) {
                    self.removeStar(file);
                    return next.call(this, file);
                };
            }
        });
        this.register(this.handler);
    }
    applyStar(file: StarredFile, el?: HTMLElement) {
        if (!this.fileExplorers.length) return;
        if (this.files.has(file.path)) return;

        for (let explorer of this.fileExplorers) {
            const element =
                el ??
                explorer.view?.fileItems?.[file.path]?.titleEl ??
                explorer.containerEl.querySelector(
                    `.nav-file-title[data-path="${file}"]`
                );
            if (!element) continue;

            this.files.add(file.path);

            setIcon(element.createDiv("prominent-star"), "star-glyph");
        }
    }
    removeStar(file: StarredFile) {
        if (!this.fileExplorers.length) return;

        for (let explorer of this.fileExplorers) {
            const element = explorer.containerEl.querySelector(
                `.nav-file-title[data-path="${file.path}"]`
            );
            if (!element) continue;
            this.files.delete(file.path);

            const stars = element.querySelectorAll(".prominent-star");
            if (stars.length) stars.forEach((star) => star.detach());
        }
    }
    onunload() {
        console.log("Prominent Starred Files plugin unloaded");
        for (let file of this.instance?.items ?? []) {
            this.removeStar(file);
        }
    }
}
