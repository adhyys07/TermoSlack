import blessed from 'blessed';
import { sendMessage, loadMessages,getUserToken } from './user_client.js';
import { logInfo, logError } from './logger.js';
import { getCachedImage } from './image_cache.js';

let screen, channelList, chatBox, input, header, statusBar, navbar, channelsBtn, dmsBtn, searchBox, joinBox, imageViewer, suggestionsBox;
let channels = [];
let currentChannelId = null;
let currentView = 'channels'; // 'channels' or 'dms'
let searchMode = false;
let searchQuery = '';
let joinMode = false;
let messages=[];
let selectedMessageIndex=-1;
let allPublicChannels = [];
let selectedSuggestion = 0;

export function createUI() {
  screen = blessed.screen({
    smartCSR: true,
    title: 'TermoSlack',
    fullUnicode: true,
    sendFocus: true
  });

  // Header
  header = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    content: '{center}{bold}TermoSlack - Slack Terminal Client{/bold}{/center}',
    tags: true,
    style: {
      fg: 'white',
      bg: "black"
    }
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
    tags: true,
    mouse: false,
    parseTags: true,
    invertSelected: false,
    style: {
      fg: 'white',
      bg: 'black',
      selected: {
        fg: 'black',
        bg: 'white'
      },
      border: {
        fg: 'white'
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
    tags: true,
    wrap: true,
    scrollbar: {
      ch: ' ',
      inverse: true
    },
    style: {
      fg: 'white',
      bg: 'black',
      border: {
        fg: 'white'
      }
    },
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
    style:{
      fg: 'white',
      bg: 'black',
      border:{
        fg:'white'
      }
    },
    border: {
      type: 'line'
    }
  });

  // Channels Button
  channelsBtn = blessed.button({
    bottom: 0,
    left: 0,
    width: '33%',
    height: 3,
    content: '{center}[F1] Channels | [Ctrl+F] Search{/center}',
    tags: true,
    style:{
      fg: 'white',
      bg: 'black',
    }
  });

  // DMs Button
  dmsBtn = blessed.button({
    bottom: 0,
    left: '33%',
    width: '33%',
    height: 3,
    content: '{center}[F2] Direct Messages{/center}',
    tags: true,
    style:{
      fg: 'white',
      bg: 'black',
    }
  });

  // Status Bar (overlay on left panel)
  statusBar = blessed.box({
    top: 3,
    left: '66%',
    width: '34%',
    height: 3,
    content: ' Status: Ready',
    style:{
      fg: 'white',
      bg: 'black',
    }
  });

  // Search Box (hidden by default)
  searchBox = blessed.textbox({
    top: 3,
    left: 0,
    width: '25%',
    height: 3,
    label: ' Search (Esc to cancel) ',
    inputOnFocus: true,
    hidden: true,
    style:{
      fg: 'white',
      bg: 'black',
      border:{
        fg:'yellow'
      }
    },
    border: {
      type: 'line'
    }
  });

  // Join Channel Box (hidden by default)
  joinBox = blessed.textbox({
    top: 3,
    left: 0,
    width: '25%',
    height: 3,
    label: ' Join Channel (Esc to cancel) ',
    inputOnFocus: true,
    hidden: true,
    style:{
      fg: 'white',
      bg: 'black',
      border:{
        fg:'green'
      }
    },
    border: {
      type: 'line'
    }
  });

  // Suggestions Box for channel join (hidden by default)
  suggestionsBox = blessed.list({
    top: 6,
    left: 0,
    width: '25%',
    height: 10,
    label: ' Suggestions ',
    hidden: true,
    keys: true,
    vi: true,
    tags: true,
    style: {
      fg: 'white',
      bg: 'black',
      selected: {
        fg: 'black',
        bg: 'green'
      },
      border: {
        fg: 'green'
      }
    },
    border: {
      type: 'line'
    }
  });

  imageViewer = blessed.box({
    top: 'center',
    left: 'center',
    width: '80%',
    height: '80%',
    label: ' Image Viewer (Press Esc to close) ',
    hidden: true,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    tags: true,
    style: {
      fg: 'white',
      bg: 'black',
      border: {
        fg: 'cyan'
      }
    },
    border: {
      type: 'line'
    }
  });

  screen.append(header);
  screen.append(channelList);
  screen.append(chatBox);
  screen.append(input);
  screen.append(searchBox);
  screen.append(imageViewer);
  screen.append(channelsBtn);
  screen.append(dmsBtn);
  screen.append(statusBar);
  screen.append(joinBox);
  screen.append(suggestionsBox);

  // Start with channel list focused
  channelList.focus();
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
    screen.render();
  });

  // Arrow keys for scrolling messages
  screen.key(['up'], () => {
    if (chatBox.focused) {
      chatBox.scroll(-1);
      screen.render();
    }
  });

  screen.key(['down'], () => {
    if (chatBox.focused) {
      chatBox.scroll(1);
      screen.render();
    }
  });

  // Page Up - Load more messages (3-4 days of history)
  screen.key(['pageup'], async () => {
    if (chatBox.focused && currentChannelId) {
      await loadMoreMessages();
    }
  });

  // Ctrl+F - Activate search
  screen.key(['C-f'], () => {
    if(!searchMode) {
      searchMode = true;
      searchBox.show();
      searchBox.focus();
      screen.render();
  }
  });

  // Ctrl+J - Join channel
  screen.key(['C-j'], async () => {
    if (currentView === 'channels' && !joinMode) {
      joinMode = true;
      joinBox.show();
      joinBox.focus();
      
      // Load all public channels if not loaded
      if (allPublicChannels.length === 0) {
        statusBar.setContent(' Status: Loading public channels...');
        screen.render();
        try {
          const { getUserClient } = await import('./user_client.js');
          const client = getUserClient();
          const result = await client.conversations.list({
            exclude_archived: true,
            types: 'public_channel',
            limit: 1000
          });
          allPublicChannels = result.channels || [];
          statusBar.setContent(` Status: ${allPublicChannels.length} public channels available`);
        } catch (error) {
          statusBar.setContent(' Status: Failed to load channels');
          logError('Failed to load public channels', error);
        }
      }
      
      screen.render();
    }
  });

  // O key - Open image in browser
  screen.key(['o'], async () => {
    if (!imageViewer.hidden && imageViewer.currentImageUrl) {
      try {
        const open = (await import('open')).default;
        await open(imageViewer.currentImageUrl);
        statusBar.setContent(' Status: Opening image in browser...');
        screen.render();
      } catch (error) {
        statusBar.setContent(' Status: Failed to open browser');
        screen.render();
      }
    }
  });

  screen.key(['escape'], () => {
    if (!imageViewer.hidden) {
      imageViewer.hide();
      chatBox.focus();
    } else if (searchMode) {
      searchMode = false;
      searchQuery = '';
      searchBox.hide();
      searchBox.clearValue();
      updateView();
      channelList.focus();
    } else if (joinMode) {
      joinMode = false;
      joinBox.hide();
      joinBox.clearValue();
      suggestionsBox.hide();
      channelList.focus();
    } else {
      channelList.focus();
    }
    screen.render();
  });

  // Channel selection (keyboard)
  channelList.on('select', async (item, index) => {
    await selectChannel(index);
  });

    screen.key(['i', 'v'], async () => {
    if (messages.length > 0) {
      // Find messages with images and show the most recent one
      const messagesWithImages = messages.filter(msg => msg.has_images);
      
      if (messagesWithImages.length > 0) {
        await showImage(messagesWithImages[messagesWithImages.length - 1]);
      } else {
        statusBar.setContent(' Status: No images in this channel');
        screen.render();
      }
    } else {
      statusBar.setContent(' Status: No messages loaded');
      screen.render();
    }
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

  // Search box handlers
  searchBox.on('submit', (value) => {
    searchQuery = value.toLowerCase().trim();
    searchMode = false;
    searchBox.hide();
    updateView();
    channelList.focus();
    screen.render();
  });

  searchBox.on('cancel', () => {
    searchMode = false;
    searchQuery = '';
    searchBox.hide();
    updateView();
    channelList.focus();
    screen.render();
  });

  // Join box input handler - show suggestions
  joinBox.on('keypress', (ch, key) => {
    if (key.name === 'down' && !suggestionsBox.hidden) {
      // Move selection down in suggestions
      suggestionsBox.down();
      screen.render();
      return;
    }
    if (key.name === 'up' && !suggestionsBox.hidden) {
      // Move selection up in suggestions
      suggestionsBox.up();
      screen.render();
      return;
    }
    
    setTimeout(() => {
      const query = joinBox.getValue().toLowerCase().trim();
      
      if (query.length > 0) {
        const suggestions = allPublicChannels
          .filter(ch => ch.name.toLowerCase().includes(query))
          .slice(0, 10)
          .map(ch => `# ${ch.name}${ch.topic?.value ? ' - ' + ch.topic.value.substring(0, 40) : ''}`);
        
        if (suggestions.length > 0) {
          suggestionsBox.setItems(suggestions);
          suggestionsBox.show();
        } else {
          suggestionsBox.hide();
        }
      } else {
        suggestionsBox.hide();
      }
      screen.render();
    }, 10);
  });

  // Join box handlers
  joinBox.on('submit', async (value) => {
    let channelName = value.trim();
    
    // If suggestions are visible and a suggestion is selected, use that
    if (!suggestionsBox.hidden) {
      const selectedItem = suggestionsBox.getItem(suggestionsBox.selected);
      if (selectedItem) {
        channelName = selectedItem.getText().replace(/^# /, '').split(' - ')[0];
      }
    }
    
    joinMode = false;
    joinBox.hide();
    suggestionsBox.hide();
    
    if (channelName) {
      statusBar.setContent(` Status: Joining #${channelName}...`);
      screen.render();
      
      try {
        const { joinChannel } = await import('./user_client.js');
        const result = await joinChannel(channelName);
        
        if (result.success) {
          statusBar.setContent(` Status: Successfully joined #${channelName} ✓`);
          statusBar.style.fg = 'green';
          
          // Reload channels to show the newly joined channel
          if (reloadChannelsCallback) {
            await reloadChannelsCallback();
          } else if (global.reloadChannels) {
            await global.reloadChannels();
          }
        } else {
          statusBar.setContent(` Status: Failed to join - ${result.error}`);
          statusBar.style.fg = 'red';
        }
      } catch (error) {
        statusBar.setContent(` Status: Error joining channel - ${error.message}`);
        statusBar.style.fg = 'red';
      }
    }
    
    channelList.focus();
    screen.render();
  });

  joinBox.on('cancel', () => {
    joinMode = false;
    joinBox.hide();
    channelList.focus();
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
      if (ch.type !== 'channel') return false;
      // Apply search filter
      if (searchQuery) {
        return ch.name.toLowerCase().includes(searchQuery);
      }
      return true;
    } else {
      if (ch.type !== 'dm' && ch.type !== 'mpim') return false;
      // Apply search filter
      if (searchQuery) {
        return ch.name.toLowerCase().includes(searchQuery);
      }
      return true;
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
      const loadedMessages = await loadMessages(currentChannelId);
      messages = loadedMessages;
      displayMessages(loadedMessages);
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
    channelsBtn.setContent('{center}> [F1] Channels | [Ctrl+F] Search | [Ctrl+J] Join <{/center}');
    dmsBtn.setContent('{center}[F2] Direct Messages{/center}');
  } else {
    channelsBtn.setContent('{center}[F1] Channels{/center}');
    dmsBtn.setContent('{center}> [F2] DMs | [Ctrl+F] Search <{/center}');
  }
  screen.render();
}

function updateView() {
  let filteredChannels;
  
  if (currentView === 'channels') {
    channelList.setLabel(' Channels ');
    filteredChannels = channels.filter(ch => ch.type === 'channel');
    
    // Apply search filter
    if (searchQuery) {
      filteredChannels = filteredChannels.filter(ch => 
        ch.name.toLowerCase().includes(searchQuery)
      );
    }
    
    const channelItems = filteredChannels.map(ch => 
      (ch.is_private ? '🔒 ' : '# ') + ch.name
    );
    channelList.setItems(channelItems);
    
    const statusText = searchQuery 
      ? ` Status: Search "${searchQuery}" - ${channelItems.length} channels`
      : ` Status: Viewing Channels (${channelItems.length})`;
    statusBar.setContent(statusText);
  } else if (currentView === 'dms') {
    channelList.setLabel(' Direct Messages ');
    filteredChannels = channels.filter(ch => ch.type === 'dm' || ch.type === 'mpim');
    
    // Apply search filter
    if (searchQuery) {
      filteredChannels = filteredChannels.filter(ch => 
        ch.name.toLowerCase().includes(searchQuery)
      );
    }
    
    const dmItems = filteredChannels.map(ch => '💬 {bold}' + ch.name + '{/bold}');
    channelList.setItems(dmItems);
    
    const statusText = searchQuery 
      ? ` Status: Search "${searchQuery}" - ${dmItems.length} DMs`
      : ` Status: Viewing DMs (${dmItems.length})`;
    statusBar.setContent(statusText);
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

function displayMessages(msgs) {
  if (!msgs || msgs.length === 0) {
    chatBox.setContent('No messages in this channel.');
    return;
  }

  // Store messages in reverse order (newest first for display)
  messages = [...msgs].reverse();

  const formattedMessages = messages.map(msg => {
    const timestamp = new Date(parseFloat(msg.ts) * 1000).toLocaleString();
    const username = msg.user_name || msg.username || 'Unknown';
    const imageIndicator = msg.has_images ? ' 📷' : '';
    return `[${timestamp}] {blue-fg}{bold}${username}{/bold}{/blue-fg}:${imageIndicator} ${msg.text || ''}`;
  }).join('\n\n');

  chatBox.setContent(formattedMessages);
  chatBox.setScrollPerc(100);
  screen.render();
}

async function loadMoreMessages() {
  if (!currentChannelId) return;
  
  try {
    statusBar.setContent(' Status: Loading more messages...');
    screen.render();
    
    // Get oldest message timestamp
    const oldestMessage = messages[0];
    const oldestTs = oldestMessage ? oldestMessage.ts : undefined;
    
    // Load messages from 3-4 days ago (limit 100)
    const olderMessages = await loadMessages(currentChannelId, 100, oldestTs);
    
    if (olderMessages && olderMessages.length > 0) {
      // Prepend older messages
      const newMessages = [...olderMessages.reverse(), ...messages];
      messages = newMessages;
      
      const formattedMessages = messages.map(msg => {
        const timestamp = new Date(parseFloat(msg.ts) * 1000).toLocaleString();
        const username = msg.user_name || msg.username || 'Unknown';
        const imageIndicator = msg.has_images ? ' 📷' : '';
        return `[${timestamp}] {blue-fg}{bold}${username}{/bold}{/blue-fg}:${imageIndicator} ${msg.text || ''}`;
      }).join('\n\n');
      
      chatBox.setContent(formattedMessages);
      statusBar.setContent(` Status: Loaded ${olderMessages.length} more messages`);
      logInfo(`Loaded ${olderMessages.length} older messages`);
    } else {
      statusBar.setContent(' Status: No more messages to load');
    }
    
    screen.render();
  } catch (error) {
    statusBar.setContent(` Status: Error loading messages - ${error.message}`);
    logError('Failed to load more messages', error);
    screen.render();
  }
}

async function showImage(message) {
  try {
    const imageFile = message.image_files[0];
    const token = getUserToken();
    
    statusBar.setContent(' Status: Loading image...');
    screen.render();
    
    // Use highest quality available
    const imageUrl = imageFile.url_private_download || 
                     imageFile.url_private || 
                     imageFile.url_download ||
                     imageFile.thumb_720 ||
                     imageFile.thumb_480 ||
                     imageFile.thumb_360 ||
                     imageFile.thumb_80;
    
    const imageText = await getCachedImage(imageUrl, token, {
      width: '100%',
      height: '100%'
    });
    
    const imageInfo = `File: ${imageFile.name} | Size: ${(imageFile.size / 1024).toFixed(1)} KB\nPress Esc to close | Press O to open in browser`;
    
    imageViewer.setContent(`${imageText}\n\n{center}${imageInfo}{/center}`);
    imageViewer.show();
    imageViewer.focus();
    
    // Store current image URL for browser opening
    imageViewer.currentImageUrl = imageFile.permalink || imageFile.url_private;
    
    statusBar.setContent(' Status: Viewing image (O=browser, Esc=close)');
    screen.render();
  } catch (error) {
    statusBar.setContent(` Status: Failed to load image - ${error.message}`);
    logError('Failed to show image', error);
    screen.render();
  }
}

export function render() {
  screen.render();
}

// Reload channels callback
let reloadChannelsCallback = null;

export function setReloadChannelsCallback(callback) {
  reloadChannelsCallback = callback;
}