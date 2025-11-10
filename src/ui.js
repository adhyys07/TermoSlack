import blessed  from "neo-blessed";
import chalk from "chalk";

export function createUI() {
    const screen = blessed.screen({
        smartCSR: true,
        title: "TermoSlack",
    });

    const channelList = blessed.list({
        label: ' Channels ',
        width : '30%',
        height: '100%-3',
        top: 0,
        left: 0,
        keys : true,
        border : "line",
        style:{
            fg: "white",
            bg: "black",
            selected: {bg: "blue"},
        },
    });

    const chatBox = blessed.box({
        label: " Chat ",
        width : '80%',
        height: "100%-3 ",
        top: 0,
        left : "20%",
        border : "line",
        tag:true,
        scrollable: true,
        alwaysScroll: true,
        scrollbar :{
            ch: " ",
            style: {bg: "blue"}
        },
    });

    const input = blessed.textbox({
        bottom: 0,
        height: 3,
        inputonFocus: true,
        keys: true,
        mouse:true,
        border: "line",
        label: " Message ",
    })
    screen.append(channelList);
    screen.append(chatBox);
    screen.append(input);
    
    input.focus();

    screen.key(['C-c'], () => process.exit(0));
    
    const ui = {
        currentchannel: null,
        screen,
        channelList,
        chatBox,
        input,

        log(msg) {
            chatBox.insertBottom(chalk.gray(msg));
            chatBox.scrollTo(chatBox.getScrollHeight());
            screen.render();
        },
        
        addMessage(user, text) {
            chatBox.insertBottom(chalk.cyan(`[${user}] `) + text);
            chatBox.scrollTo(chatBox.getScrollHeight());
            screen,render();
        },

        setChannels(channels) {
            channelList.setItems(channels.map(c => c.name));
            screen.render();
        },

        onChannelSelect(callback){
            channelList.on("select", (item, index) => callback(item, index));
        },

        onSend(callback){
            input.on("submit", (msg) => {
                callback(msg);
                input.clearValue();
                screen.render();
                input.focus();
        });
        }
    };
    return ui;
}