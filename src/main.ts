// @ts-nocheck

import { Plugin } from "obsidian";

import "./main.css";

export default class ProminentStarredFiles extends Plugin {
    items: any[];
    async onload(): Promise<void> {
        console.log("Prominent Starred Files plugin loaded");

        this.app.internalPlugins.plugins.starred.instance.items = new Proxy(
            this.app.internalPlugins.plugins.starred.instance.items,
            {
                get: (target, property) => {
                    if (
                        property === "IDENTITY" &&
                        !target.hasOwnProperty("IDENTITY")
                    ) {
                        // missing '!'
                        return target;
                    }
                    // property is index in this case
                    return target[property];
                },
                set: (target, property, value, receiver) => {
                    //target[property] = value;
                    if (value.hasOwnProperty("type")) {
                        this.items = [...target, value];
                        this.refreshStars();
                    }
                    return Reflect.set(target, property, value, receiver);
                    // you have to return true to accept the changes
                    //return true;
                }
            }
        );
    }
    refreshStars() {
        console.log(this.app.workspace.leftSplit);
        let titleNodes = this.app.workspace.leftSplit.containerEl.querySelectorAll(
            ".nav-file"
        );
        console.log(titleNodes);
    }
    onunload() {
        console.log("Prominent Starred Files plugin unloaded");
        this.app.internalPlugins.plugins.starred.instance.items = this.app.internalPlugins.plugins.starred.instance.items.IDENTITY;
    }
}
