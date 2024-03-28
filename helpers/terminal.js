const path = require('path');
const termkit = require('terminal-kit');

class Terminal {
    constructor(_config, mainFunc) {
        let self = this;

        this.mainFunc = mainFunc;

        this.term = termkit.terminal;
        this.term.fullscreen(true);

        this.document = this.term.createDocument();
        this.progressBars = {};

        this.changeLayout("main");

        this.term.hideCursor();
        this.term.on('key', (key) => {
            if (key === 'CTRL_C') {
                self.terminate();
            }
            else if (key === 'CTRL_R') {
                self.clear();
                self.mainFunc();
            }
        });
        this.term.stdout.on('resize', () => {
            if (self.document.elements.header_text) {
                self.setHeader(self.document.elements.header_text.content[0]);
            }
            if (self.activeEl && self.document) {
                self.setFocus();
            }
        });
    }

    async showMainMenuPrompt() {
        this.changeLayout("main");

        let choices = [
            {content: "1. Update all books under the configured directory.", value: "all"},
            {content: "2. Update selected books under the configured directory.", value: "manual"},
            {content: "3. Exit the program.", value: "exit"}
        ];

        let colMenu = new termkit.ColumnMenu({
            parent: this.document.elements.body,
            y: 0,
            autoWidth: true,
            autoHeight: true,
            items: choices
        });

        this.setFocus(colMenu);

        /*let textbox = new termkit.TextBox({
            parent: this.document.elements.body,
            content: util.inspect(this.document.elements.header),
            scrollable: true,
            vScrollBar: true,
            autoWidth: true,
            autoHeight: true,
            //hScrollBar: true ,
            //lineWrap: true ,
            wordWrap: true,
        });*/
        
        let resp = await colMenu.waitFor('submit');
        this.document.elements.body.clear();

        let updateModeResp = resp;
        if (updateModeResp === "exit") return this.terminate();

        this.createText("Would you like to manually select metadata for each series?\n", 0);

        let manualModeResp = await this.showUpdateMenuPrompt();

        if (manualModeResp === "mainmenu") return this.showMainMenuPrompt();
        else return {
            updateMode: updateModeResp,
            manualMode: manualModeResp
        }
    }

    async showUpdateMenuPrompt() {
        let choices = [
            { content: "1. No.", value: 0 },
            { content: "2. Yes.", value: 1 },
            { content: "3. Return to Main Menu.", value: "mainmenu" }
        ];

        let colMenu = new termkit.ColumnMenu({
            parent: this.document.elements.body,
            y: 2,
            autoWidth: true,
            autoHeight: true,
            items: choices
        });

        this.setFocus(colMenu);

        let resp = await colMenu.waitFor('submit');
        this.document.elements.body.clear();

        return resp;
    }

    async showDirectoryPrompt(dir, getDir) {
        this.createText("Select which directory to update from:\n", 0);
        this.createText(`(Currently in ${dir})\n\n`, 1);

        let directories = await getDir(dir);
            directories = directories.map((dir)=>{
                return {"content": dir, "value": dir}
            });

        let colMenu = new termkit.ColumnMenu({
            parent: this.document.elements.body,
            y: 3,
            autoWidth: true,
            autoHeight: true,
            items: [
                {"content": "^YSelect current directory", "markup": true, "value": "selected_dir"},
                {"content": "", "disabled": true, "value": "" },
                {"content": "../", "value": "../"},
            ].concat(directories)
        });

        this.setFocus(colMenu);

        let resp = await colMenu.waitFor('submit');
        this.document.elements.body.clear();

        if (resp !== "selected_dir") return this.showDirectoryPrompt(path.join(dir, resp), getDir);
        else return dir;
    }

    async showUpdateScreen(){
        this.changeLayout("metadata");
        let textBox = new termkit.TextBox({
            parent: this.document.elements.body,
            id: "logBox",
            content: "",
            contentHasMarkup: true,
            scrollable: true,
            vScrollBar: true,
            //wordWrap: true,
            x: 0,
            y: 0,
            autoWidth: true,
            autoHeight: true
        });
        this.setFocus(textBox);
    }

    async showManualProviderWindow(providersObj){
        this.document.elements.logBox.hide();
        
        let self = this;
        let row = 4;
        let buttons = {};

        let formContainer = new termkit.Container({
            parent: this.document.elements.body,
            autoWidth: true,
            autoHeight: true
        });

        let header = new termkit.Text({
            parent: formContainer,
            x: 1,
            y: 2,
            content: "Select which metadata providers to use for this book:",
            attr: { color: 'cyan', bold: true }
        });

        for (let [providerName, seriesData] of Object.entries(providersObj)) {
            let label = `${providerName} (Title Found: ${seriesData.Series || '?'})`;
            buttons[providerName] = new termkit.ToggleButton({
                parent: formContainer,
                content: `[ ] ${label}`,
                turnedOnContent: `[x] ${label}`,
                turnedOnBlurAttr: { color: 'green' },
                turnedOffBlurAttr: { color: 'red' },
                turnedOnFocusAttr: { color: 'green', bold: true },
                turnedOffFocusAttr: { color: 'red', bold: true },
                value: true,
                x: 3,
                y: row++,
            });
        }

        row++;

        for (let btnName of ['Submit', 'Cancel']) {
            buttons[btnName] = new termkit.Button({
                parent: formContainer,
                content: `[${btnName}]`,
                value: 'submit',
                blurAttr: {},
                focusAttr: { bgColor: 'grey', bold: true },
                x: 1,
                y: row++
            });
        }

        for (let btn of Object.values(buttons)) {
            btn.on('key', function (e) {
                if (e === "UP" || e === "LEFT") btn.parent.focusPreviousChild();
                else if (e === "DOWN" || e === "RIGHT") btn.parent.focusNextChild();
            });
        }

        this.setFocus(buttons['Submit']);

        return new Promise(function (resolve, reject) {
            buttons['Cancel'].once('submit', function () { 
                resolve(null);
            });

            buttons['Submit'].once('submit', function () {
                let selectedProviders = Object.entries(buttons)
                                              .filter((provider) => provider[1].value && ["Submit", "Cancel"].indexOf(provider[0]) === -1)
                                              .map((provider) => provider[0]);

                formContainer.destroy();

                self.document.elements.logBox.show();

                resolve(selectedProviders);
            });
        });
    }

    appendTextBox(text){
        if (!this.document.elements.logBox) return;
        this.document.elements.logBox.appendLog(text+"\n");
    }

    createText(text, y){
        new termkit.Text({
            parent: this.document.elements.body,
            y: y || 0,
            content: text,
            attr: { color: 'cyan', bold: true }
        });
    }

    createProgressBar(opt){
        let progressBar = new ProgressBar(opt, this.term, this.document.elements.footer);
        this.progressBars[opt.type] = progressBar;

        return progressBar;
    }

    changeLayout(id) {
        this.activeEl = null;
        this.term.clear();
        this.document.clear();

        if (id === 'main') {
            this.layout = new termkit.Layout({
                parent: this.document,
                boxChars: 'double',
                layout: {
                    id: 'main',
                    y: 0,
                    widthPercent: 100,
                    heightPercent: 100,
                    rows: [
                        {
                            id: 'header',
                            height: 3
                        },
                        {
                            id: 'body',
                        }
                    ]
                }
            });
            this.setHeader("Welcome to m-info!");
        }
        else if (id === 'metadata') {
            this.layout = new termkit.Layout({
                parent: this.document,
                boxChars: 'double',
                layout: {
                    id: 'metadata',
                    y: 0,
                    widthPercent: 100,
                    heightPercent: 100,
                    rows: [
                        {
                            id: 'header',
                            height: 3
                        },
                        {
                            id: 'body',
                        },
                        {
                            id: 'footer',
                            height: 6
                        }
                    ]
                }
            });
            this.setHeader("Welcome to m-info!");
        }
    }

    setHeader(text) {
        this.document.elements.header.clear();
        new termkit.Text({
            id: "header_text",
            parent: this.document.elements.header,
            content: text,
            autoWidth: true,
            autoHeight: true,
            x: Math.ceil((this.term.width / 2) - (text.length / 2)),
            attr: { color: 'cyan', bold: true }
        });
    }

    setNextTask(id){
        if (this.progressBars[id]){
            this.progressBars[id].nextItem();
        }
    }

    setFocus(el){
        if (el){
            this.activeEl = el;
            this.document.giveFocusTo(el);
        }
        else this.document.giveFocusTo(this.activeEl);
    }

    clear() {
        return this.term.clear();
    }

    terminate() {
        this.term.grabInput(false);
        this.term.hideCursor(false);
        this.term.styleReset();
        this.term.clear();
        setTimeout(function(){process.exit();}, 100);
    }
}

class ProgressBar {
    constructor(opt, term, parent) {
        this.title = opt.title;
        this.type = opt.type;
        this.pos = opt.pos || {x: 0, y: 0};
        this.allTasks = opt.tasks || [];
        this.currentTasks = opt.tasks || [];
        this.totalTasks = this.allTasks.length
        this.term = term;

        this.el = new termkit.Bar({
            content: this.title || '...',
            x: this.pos.x,
            y: this.pos.y,
            autoWidth: true,
            parent: parent,
            barChars: 'classicWithHalf',
            value: 10
        });
    }
    setTasks(tasks) {
        this.allTasks = tasks || [];
        this.currentTasks = tasks || [];
        this.totalTasks = tasks.length;
        this.el.setValue(1 - (tasks.length ? 1 : 0));
        this.el.setContent(tasks[0] || '...');
    }
    progress(){
        this.currentTasks.shift();

        if (this.currentTasks.length) {
            this.el.setContent(this.currentTasks[0]);
        }
        else {
            this.el.setContent("Done!");
        }

        if (this.totalTasks)
            this.el.setValue(1-this.currentTasks.length/this.totalTasks);
        else
            this.el.setValue(1);
    }
    reset() {
        this.currentTasks = this.allTasks;
        this.el.setValue(1 - (this.currentTasks.length ? 1 : 0));
        this.el.setContent(this.currentTasks[0] || '...');
    }
    hide() {
        return this.el.hide();
    }
}

module.exports = Terminal;