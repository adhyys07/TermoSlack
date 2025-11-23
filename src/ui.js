import blessed  from "neo-blessed";
import chalk from "chalk";

export function createUI() {
    const screen = blessed.screen({
        smartCSR: true,
        title: "TermoSlack",
    });

    const channelList = blessed.list({
        label: ' Channels ',
        width : '25%',
        height: '100%-3',
        top: 0,
        left: 0,
        keys : true,
        vi: true,
        mouse: true,
        border : "line",
        style: {
            selected: {
                bg: "blue",
                fg: "white"
            },
            focus: {
                border: {
                    fg: "green"
                }
            }
        },
        interactive: true,
        scrollable: true
    });

    const chatBox = blessed.box({
        label: " Chat ",
        width : '75%',
        height: "100%-3 ",
        top: 0,
        left : "25%",
        border : "line",
        tags:true,
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
            ch: " ",
            style: {
                bg: "blue"
            }
        }
    });

    const input = blessed.textbox({
        bottom: 0,
        height: 3,
        inputOnFocus: true,
        keys: true,
        mouse: true,
        width: "100%",
        border: "line",
        label: " Message (Tab to switch focus, Enter to send) ",
        style: {
            focus: {
                border: {
                    fg: "green"
                }
            }
        }
    });

    screen.append(channelList);
    screen.append(chatBox);
    screen.append(input);
    
    // Start with channel list focused
    channelList.focus();

    // Key bindings for switching focus
    screen.key(['tab'], () => {
        if (channelList.focused) {
            input.focus();
        } else {
            channelList.focus();
        }
        screen.render();
    });

    screen.key(['escape'], () => {
        channelList.focus();
        screen.render();
    });

    screen.key(['C-c'], () => process.exit(0));
    
        const ui = {
        screen, channelList, chatBox, input, currentChannel: null, channelObjects: [],
        log(msg) { chatBox.insertBottom(chalk.gray(msg)); chatBox.scrollTo(chatBox.getScrollHeight()); screen.render(); },
        addMessage(user, text) { chatBox.insertBottom(chalk.cyan(`[${user}] `) + text); chatBox.scrollTo(chatBox.getScrollHeight()); screen.render(); },
        setChannels(channels) { 
                // store full channel objects so selection maps correctly
                ui.channelObjects = channels.map(c => {
                    const displayName = c.displayName || c.name || c.id || '<unknown>';
                    
                    return { 
                        id: c.id || c.channel || c.conversation || null, 
                        name: displayName,
                        rawChannel: c
                    };
                });
                channelList.setItems(ui.channelObjects.map(c => c.name));
                screen.render();
        },
        onChannelSelect(cb) { channelList.on("select", (item, i) => cb(item, i)); },
        onSend(cb) { input.on("submit", (msg) => { cb(msg); input.clearValue(); screen.render(); input.focus(); }); }
    };
    return ui;
}