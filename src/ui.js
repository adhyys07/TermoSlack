import blessed from 'blessed';
import { sendMessage, loadMessages } from './user_client.js';
import { logInfo, logError } from './logger.js';

let screen, channelList, chatBox, input, header, statusBar, navbar, channelsBtn, dmsBtn;
let channels = [];
let currentChannelId = null;
let currentView = 'channels'; // 'channels' or 'dms'

export function createUI() {
  screen = blessed.screen({
    smartCSR: true,
    title: 'TermoSlack',
    fullUnicode: true
  });

  // Header
  header = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    content: '{center}TermoSlack - Slack Terminal Client{/center}',
    tags: true
  });

  // Channel/DM List (left side)
  channelList = blessed.list({
    top: 3,
    left: 0,
    width: '25%',
    height: '100%-6',
    label: ' Channels ',
    keys: true,
    vi: true,
    interactive: true,
    style: {
      selected: {
        inverse: true
      }
    },
    border: {
      type: 'line'
    }
  });

  // Chat Box (right side)
  chatBox = blessed.box({
    top: 3,
    left: '25%',
    width: '75%',
    height: '100%-9',
    label: ' Messages ',
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    border: {
      type: 'line'
    }
  });

  // Input Box
  input = blessed.textbox({
    bottom: 3,
    left: '25%',
    width: '75%',
    height: 3,
    label: ' Type message (Tab to focus, Enter to send) ',
    inputOnFocus: true,
    border: {
      type: 'line'
    }
  });

  // Channels Button
  channelsBtn = blessed.button({
    bottom: 0,
    left: 0,
    width: '50%',
    height: 3,
    content: '{center}[F1] Channels{/center}',
    tags: true
  });

  // DMs Button
  dmsBtn = blessed.button({
    bottom: 0,
    left: '50%',
    width: '50%',
    height: 3,
    content: '{center}[F2] Direct Messages{/center}',
    tags: true
  });

  // Status Bar (overlay on left panel)
  statusBar = blessed.box({
    top: 3,
    left: 0,
    width: '25%',
    height: 1,
    content: ' Status: Ready'
  });

  screen.append(header);
  screen.append(channelList);
  screen.append(chatBox);
  screen.append(input);
  screen.append(channelsBtn);
  screen.append(dmsBtn);
  screen.append(statusBar);

  // Start with channel list focused
  channelList.focus();
  updateBorders();
  updateButtonStyles();

  // === KEYBOARD SHORTCUTS ===

  screen.key(['C-c'], () => {
    return process.exit(0);
  });

  // F1 - Switch to Channels view
  screen.key(['f1'], () => {
    currentView = 'channels';
    updateView();
    updateButtonStyles();
  });

  // F2 - Switch to DMs view
  screen.key(['f2'], () => {
    currentView = 'dms';
    updateView();
    updateButtonStyles();
  });

  // Tab - Switch focus between channel list and input
  screen.key(['tab'], () => {
    if (channelList.focused) {
      input.focus();
    } else if (input.focused) {
      chatBox.focus();
    } else {
      channelList.focus();
    }
    updateBorders();
    screen.render();
  });

  // Escape - Return to channel list
  screen.key(['escape'], () => {
    channelList.focus();
    updateBorders();
    screen.render();
  });

  // Channel selection (keyboard)
  channelList.on('select', async (item, index) => {
    await selectChannel(index);
  });

  // Message input submission
  input.on('submit', async (value) => {
    if (!currentChannelId) {
      statusBar.setContent(' Status: Please select a channel first');
      statusBar.style.fg = 'red';
      screen.render();
      input.clearValue();
      input.focus();
      return;
    }

    if (value.trim()) {
      try {
        await sendMessage(currentChannelId, value);
        statusBar.setContent(' Status: Message sent ✓');
        statusBar.style.fg = 'green';
        
        // Reload messages to show the sent message
        const messages = await loadMessages(currentChannelId);
        displayMessages(messages);
        
        logInfo(`Message sent to channel ${currentChannelId}`);
      } catch (error) {
        statusBar.setContent(` Status: Error - ${error.message}`);
        statusBar.style.fg = 'red';
        logError(`Failed to send message to channel ${currentChannelId}`, error);
      }
    }

    input.clearValue();
    input.focus();
    screen.render();
  });

  // Handle focus changes for visual feedback
  channelList.on('focus', () => {
    updateBorders();
    screen.render();
  });

  input.on('focus', () => {
    updateBorders();
    screen.render();
  });

  chatBox.on('focus', () => {
    updateBorders();
    screen.render();
  });

  screen.render();
}

async function selectChannel(index) {
  const filteredChannels = channels.filter(ch => {
    if (currentView === 'channels') {
      return ch.type === 'channel';
    } else {
      return ch.type === 'dm' || ch.type === 'mpim';
    }
  });

  const selectedChannel = filteredChannels[index];
  if (selectedChannel) {
    currentChannelId = selectedChannel.id;
    const displayName = selectedChannel.is_private 
      ? `🔒 ${selectedChannel.name}` 
      : selectedChannel.type === 'channel' 
        ? `# ${selectedChannel.name}` 
        : `💬 ${selectedChannel.name}`;
    
    chatBox.setLabel(` Messages - ${displayName} `);
    
    try {
      const messages = await loadMessages(currentChannelId);
      displayMessages(messages);
      logInfo(`Switched to channel ${selectedChannel.name} (${currentChannelId})`);
    } catch (error) {
      chatBox.setContent(`Error loading messages: ${error.message}`);
      logError('Failed to load messages for channel', error);
    }
    
    screen.render();
  }
}

function updateBorders() {
  // Just render the screen
  screen.render();
}

function updateButtonStyles() {
  if (currentView === 'channels') {
    channelsBtn.setContent('{center}> [F1] Channels <{/center}');
    dmsBtn.setContent('{center}[F2] Direct Messages{/center}');
  } else {
    channelsBtn.setContent('{center}[F1] Channels{/center}');
    dmsBtn.setContent('{center}> [F2] Direct Messages <{/center}');
  }
  screen.render();
}

function updateView() {
  let filteredChannels;
  
  if (currentView === 'channels') {
    channelList.setLabel(' Channels ');
    filteredChannels = channels.filter(ch => ch.type === 'channel');
    const channelItems = filteredChannels.map(ch => 
      (ch.is_private ? '🔒 ' : '# ') + ch.name
    );
    channelList.setItems(channelItems);
    statusBar.setContent(` Status: Viewing Channels (${channelItems.length})`);
  } else if (currentView === 'dms') {
    channelList.setLabel(' Direct Messages ');
    filteredChannels = channels.filter(ch => ch.type === 'dm' || ch.type === 'mpim');
    const dmItems = filteredChannels.map(ch => '💬 {bold}' + ch.name + '{/bold}');
    channelList.setItems(dmItems);
    statusBar.setContent(` Status: Viewing DMs (${dmItems.length})`);
  }
  
  channelList.focus();
  updateBorders();
  screen.render();
}

export function setChannels(channelData) {
  channels = channelData;
  updateView(); // Apply current view filter
}

export function updateStatus(message) {
  statusBar.setContent(` Status: ${message}`);
  screen.render();
}

function displayMessages(messages) {
  if (!messages || messages.length === 0) {
    chatBox.setContent('No messages in this channel.');
    return;
  }

  const formattedMessages = messages.reverse().map(msg => {
    const timestamp = new Date(parseFloat(msg.ts) * 1000).toLocaleString();
    const username = msg.user_name || msg.username || 'Unknown';
    return `[${timestamp}] ${username}: ${msg.text}`;
  }).join('\n\n');

  chatBox.setContent(formattedMessages);
  chatBox.scrollTo(chatBox.getScrollHeight());
}

export function render() {
  screen.render();
}