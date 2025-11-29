import blessed from 'neo-blessed';
import { sendMessage, loadMessages, getUserToken, searchMessages, loadThreadReplies, getCurrentUserId } from './user_client.js';
import { logInfo, logError } from './logger.js';
import { getCachedImage } from './image_cache.js';

let screen, channelList, chatBox, input, header, statusBar, navbar, channelsBtn, dmsBtn, searchBox, joinBox, imageViewer, suggestionsBox;
let globalSearchBox, searchResultsBox, threadBox, userSearchBox, userSuggestionsBox;
let channels = [];
let currentChannelId = null;
let currentView = 'channels'; // 'channels' or 'dms'
let searchMode = false;
let searchQuery = '';
let joinMode = false;
let globalSearchMode = false;
let threadMode = false;
let userSearchMode = false;
let messages=[];
let selectedMessageIndex=-1;
let allPublicChannels = [];
let allUsers = [];
let selectedSuggestion = 0;
let threadViewBox = null;
let activityBox = null;
let activityMatches = [];
let searchResults = [];
let searchPage = 1;
let searchTotalPages = 1;
let threadMessages = [];
let currentThreadTs = null;
let userSearchTimeout = null;
let currentUserSearchId = 0;
let allWorkspaceUsers = [];
let isUsersFullyLoaded = false;

export function createUI() {
  screen = blessed.screen({
    smartCSR: false,
    title: 'TermoSlack',
    fullUnicode: true,
    sendFocus: true,
    warnings: true
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
    wrap: false, // We'll handle wrapping manually
    scrollbar: {
      ch: '█',
      track: {
        bg: 'gray'
      },
      style: {
        inverse: true,
        bg: 'white'
      }
    },
    style: {
      fg: 'white',
      bg: 'black',
      border: {
        fg: 'white'
      },
      scrollbar: {
        bg: 'white',
        fg: 'blue'
      }
    },
    border: {
      type: 'line'
    }
  });

  // Activity Box (initially hidden)
  activityBox = blessed.list({
    top: 3,
    left: '25%',
    width: '75%',
    height: '100%-9',
    label: ' Activity (Mentions) ',
    tags: true,
    keys: true,
    vi: true,
    mouse: true,
    scrollable: true,
    scrollbar:{
      ch: ' ',
      track : { bg: 'grey'},
      style: { inverse: true }
    },
    border: {type: 'line'},
    style: {
      border: {fg: 'magenta'},
      selected: {bg: 'blue', fg: 'white'}
    },
    hidden: true
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
    content: '{center}[F1] Channels | [Ctrl+F] Filter{/center}',
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
    width: '34%',
    height: 3,
    content: '{center}[F2] DMs | [Enter] Chat | [Ctrl+D] DM User | [T] Thread{/center}',
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
    inputOnFocus: false,
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

  // User Search Box (hidden by default)
  userSearchBox = blessed.textbox({
    top: 3,
    left: 0,
    width: '25%',
    height: 3,
    label: ' Search User to DM (Esc to cancel) ',
    inputOnFocus: true,
    hidden: true,
    style:{
      fg: 'white',
      bg: 'black',
      border:{
        fg:'magenta'
      }
    },
    border: {
      type: 'line'
    }
  });

  // User Suggestions Box (hidden by default)
  userSuggestionsBox = blessed.list({
    top: 6,
    left: 0,
    width: '25%',
    height: 10,
    label: ' Users ',
    hidden: true,
    keys: true,
    vi: true,
    tags: true,
    style: {
      fg: 'white',
      bg: 'black',
      selected: {
        fg: 'black',
        bg: 'magenta'
      },
      border: {
        fg: 'magenta'
      }
    },
    border: {
      type: 'line'
    }
  });

  // Custom Confirmation Modal
  const confirmationModal = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: 50,
    height: 10,
    label: ' Confirm ',
    tags: true,
    hidden: true,
    border: { type: 'line' },
    style: {
      fg: 'white',
      bg: 'blue',
      border: { fg: 'white' }
    }
  });

  const confirmText = blessed.text({
    parent: confirmationModal,
    top: 1,
    left: 'center',
    width: '90%',
    height: 3,
    align: 'center',
    content: '',
    style: { bg: 'blue', fg: 'white' }
  });

  const yesBtn = blessed.button({
    parent: confirmationModal,
    bottom: 1,
    left: 5,
    width: 10,
    height: 3,
    content: ' Yes ',
    align: 'center',
    valign: 'middle',
    keys: true,
    mouse: true,
    style: {
      bg: 'gray',
      fg: 'white',
      focus: {
        bg: 'green',
        fg: 'black',
        bold: true
      }
    },
    border: { type: 'line' }
  });

  const noBtn = blessed.button({
    parent: confirmationModal,
    bottom: 1,
    right: 5,
    width: 10,
    height: 3,
    content: ' No ',
    align: 'center',
    valign: 'middle',
    keys: true,
    mouse: true,
    style: {
      bg: 'gray',
      fg: 'white',
      focus: {
        bg: 'red',
        fg: 'black',
        bold: true
      }
    },
    border: { type: 'line' }
  });

  // Navigation between buttons
  yesBtn.key(['right', 'tab'], () => { noBtn.focus(); screen.render(); });
  noBtn.key(['left', 'tab'], () => { yesBtn.focus(); screen.render(); });
  
  function askConfirmation(message, callback) {
      confirmText.setContent(message);
      confirmationModal.show();
      confirmationModal.setFront();
      yesBtn.focus();
      screen.render();

      function onYes() {
          cleanup();
          callback(true);
      }

      function onNo() {
          cleanup();
          callback(false);
      }

      function cleanup() {
          yesBtn.removeListener('press', onYes);
          noBtn.removeListener('press', onNo);
          confirmationModal.hide();
          screen.render();
      }

      yesBtn.once('press', onYes);
      noBtn.once('press', onNo);
  }

  imageViewer = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    hidden: true,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    tags: true,
    style: {
      fg: 'white',
      bg: 'black'
    }
  });

  // Info overlay for image viewer
  const imageInfoBox = blessed.box({
    parent: imageViewer,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    tags: true,
    style: {
      fg: 'white',
      bg: 'blue',
      transparent: true
    },
    content: ''
  });
  imageViewer.infoBox = imageInfoBox;

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
  screen.append(userSearchBox);
  screen.append(userSuggestionsBox);

  // Global Search Box (hidden by default)
  globalSearchBox = blessed.textbox({
    top: 3,
    left: '25%',
    width: '75%',
    height: 3,
    label: ' Global Search (Enter to search, Esc to cancel) ',
    hidden: true,
    inputOnFocus: true,
    tags: true,
    style: {
      fg: 'white',
      bg: 'black',
      border: {
        fg: 'yellow'
      }
    },
    border: {
      type: 'line'
    }
  });

  // Search Results Box (hidden by default)
  searchResultsBox = blessed.list({
    top: 6,
    left: '25%',
    width: '75%',
    height: '100%-12',
    label: ' Search Results ',
    hidden: true,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    interactive: true,
    tags: true,
    mouse: false,
    scrollbar: {
      ch: ' ',
      inverse: true
    },
    style: {
      fg: 'white',
      bg: 'black',
      selected: {
        fg: 'black',
        bg: 'white'
      },
      border: {
        fg: 'cyan'
      },
      scrollbar: {
        bg: 'cyan'
      }
    },
    border: {
      type: 'line'
    }
  });

  // Thread Box (hidden by default)
  threadBox = blessed.box({
    top: 3,
    left: '25%',
    width: '75%',
    height: '100%-9',
    label: ' Thread ',
    hidden: true,
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
        fg: 'magenta'
      }
    },
    border: {
      type: 'line'
    }
  });

  screen.append(globalSearchBox);
  screen.append(searchResultsBox);
  screen.append(threadBox);
  screen.append(activityBox);

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

  // F3 - Toggle Activity View
  screen.key(['f3'], async () => {
    if (currentView === 'activity') {
      currentView = 'channels'; // Default back to channels
      updateView();
      updateButtonStyles();
    } else {
      currentView = 'activity';
      updateView();
      await loadActivity();
    }
  });

  // Handle Activity Selection
  activityBox.on('select', async (item, index) => {
    const match = activityMatches[index];
    if (match && match.channel) {
      // Switch to the channel
      const channelId = match.channel.id;
      currentChannelId = channelId;
      currentView = 'channels'; // Switch to main view
      
      statusBar.setContent(` Status: Jumping to #${match.channel.name}...`);
      updateView();
      screen.render();
      
      try {
        // Load messages for this channel (background context)
        const msgs = await loadMessages(currentChannelId, 50);
        messages = msgs;
        selectedMessageIndex = messages.length - 1;
        displayMessages(messages);
        chatBox.setScrollPerc(100);
        
        // If it's a thread reply, open the thread
        if (match.thread_ts) {
          statusBar.setContent(` Status: Opening thread in #${match.channel.name}...`);
          screen.render();
          await viewThread(match.thread_ts);
        } else {
          // It's a regular message - try to highlight it
          const msgIndex = messages.findIndex(m => m.ts === match.ts);
          if (msgIndex !== -1) {
            selectedMessageIndex = msgIndex;
            displayMessages(messages);
          }
          chatBox.focus();
          statusBar.setContent(` Status: Viewed activity in #${match.channel.name}`);
        }
      } catch (error) {
        statusBar.setContent(` Status: Error loading activity - ${error.message}`);
      }
    }
  });

  // Tab - Switch focus between channel list and input
  screen.key(['tab'], () => {
    if (channelList.focused) {
      input.focus();
    } else if (input.focused) {
      channelList.focus();
    } else {
      channelList.focus();
    }
    screen.render();
  });

  // Enter - Focus chat area for message navigation
  screen.key(['enter'], () => {
    if (!input.focused && !chatBox.focused) {
      chatBox.focus();
      // Initialize selected message when focusing chat
      if (messages.length > 0 && selectedMessageIndex === -1) {
        selectedMessageIndex = messages.length - 1; // Select most recent (bottom)
        displayMessages(messages);
      }
      screen.render();
    }
  });

  // Arrow keys for scrolling messages
  screen.key(['up'], () => {
    if (chatBox.focused && messages.length > 0) {
      // UP = go to older messages (decrease index, move up visually)
      if (selectedMessageIndex > 0) {
        selectedMessageIndex--;
        displayMessages(messages);
        const msg = messages[selectedMessageIndex];
        const username = msg.user_name || msg.username || 'Unknown';
        const msgNum = selectedMessageIndex + 1;
        statusBar.setContent(` Status: Message ${msgNum}/${messages.length} - ${username}`);
        screen.render();
      }
    }
  });

  screen.key(['down'], () => {
    if (chatBox.focused && messages.length > 0) {
      // DOWN = go to newer messages (increase index, move down visually)
      if (selectedMessageIndex < messages.length - 1) {
        selectedMessageIndex++;
        displayMessages(messages);
        const msg = messages[selectedMessageIndex];
        const username = msg.user_name || msg.username || 'Unknown';
        const msgNum = selectedMessageIndex + 1;
        statusBar.setContent(` Status: Message ${msgNum}/${messages.length} - ${username}`);
        screen.render();
      }
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

  // Ctrl+S - Global Search
  screen.key(['C-s'], () => {
    if (!globalSearchMode) {
      globalSearchMode = true;
      globalSearchBox.show();
      globalSearchBox.focus();
      chatBox.hide();
      searchResultsBox.hide();
      input.hide();
      screen.render();
    }
  });

  // Ctrl+D - DM User Search
  screen.key(['C-d'], async () => {
    if (!userSearchMode) {
      userSearchMode = true;
      userSearchBox.show();
      userSearchBox.focus();
      statusBar.setContent(' Status: Type to search users...');
      screen.render();
    }
  });

  // Ctrl+J or F7 - Join channel
  screen.key(['C-j', 'f7'], async () => {
    if (!joinMode) {
      // Close other modes if active to prevent overlap
      if (searchMode) { searchMode = false; searchBox.hide(); }
      if (userSearchMode) { userSearchMode = false; userSearchBox.hide(); }
      
      joinMode = true;
      joinBox.show();
      joinBox.setFront();
      suggestionsBox.setFront();
      joinBox.focus();
      joinBox.readInput();
      statusBar.setContent(' Status: Type to search public channels...');
      screen.render();
      
      // Load all public channels if not loaded
      if (allPublicChannels.length === 0) {
        statusBar.setContent(' Status: Loading public channels directory...');
        screen.render();
        try {
          const { getUserClient } = await import('./user_client.js');
          const client = getUserClient();
          
          // Fetch channels with pagination
          let cursor;
          let channels = [];
          
          do {
             const result = await client.conversations.list({
              exclude_archived: true,
              types: 'public_channel',
              limit: 1000,
              cursor: cursor
            });
            
            channels = channels.concat(result.channels || []);
            cursor = result.response_metadata?.next_cursor;
            
            // Update status for large workspaces
            if (cursor) {
               statusBar.setContent(` Status: Loading channels... (${channels.length} found)`);
               screen.render();
            }
            
          } while (cursor);

          // Filter out channels we are already in
          allPublicChannels = channels.filter(ch => !ch.is_member);
          
          statusBar.setContent(` Status: ${allPublicChannels.length} channels available to join`);
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
    } else if (threadMode) {
      threadMode = false;
      currentThreadTs = null;
      threadBox.hide();
      chatBox.show();
      input.show();
      chatBox.focus();
    } else if (globalSearchMode) {
      globalSearchMode = false;
      globalSearchBox.hide();
      globalSearchBox.clearValue();
      searchResultsBox.hide();
      chatBox.show();
      input.show();
      channelList.focus();
    } else if (userSearchMode) {
      userSearchMode = false;
      userSearchBox.hide();
      userSearchBox.clearValue();
      userSuggestionsBox.hide();
      channelList.focus();
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
      // If in DMs view, switch back to Channels view
      if (currentView === 'dms') {
        currentView = 'channels';
        updateView();
        updateButtonStyles();
      }
      channelList.focus();
    }
    screen.render();
  });

  // T key - View thread
  screen.key(['t'], async () => {
    if (!chatBox.focused) {
      statusBar.setContent(' Status: Focus chat area first (press Enter)');
      screen.render();
      return;
    }
    
    if (!messages || messages.length === 0) {
      statusBar.setContent(' Status: No messages loaded');
      screen.render();
      return;
    }
    
    // Validate selectedMessageIndex
    if (selectedMessageIndex < 0 || selectedMessageIndex >= messages.length) {
      statusBar.setContent(' Status: No message selected. Use arrow keys to select a message');
      screen.render();
      return;
    }
    
    const selectedMessage = messages[selectedMessageIndex];
    
    if (!selectedMessage || !selectedMessage.ts) {
      statusBar.setContent(' Status: Invalid message selected');
      screen.render();
      return;
    }
    
    // Show which message is being opened
    const username = selectedMessage.user_name || selectedMessage.username || 'Unknown';
    statusBar.setContent(` Status: Opening thread from ${username}...`);
    screen.render();
    
    // Check if message has thread replies
    if (selectedMessage.reply_count && selectedMessage.reply_count > 0) {
      await viewThread(selectedMessage.ts);
    } else if (selectedMessage.thread_ts) {
      // Message is part of a thread
      await viewThread(selectedMessage.thread_ts);
    } else {
      // Start a new thread with this message
      await viewThread(selectedMessage.ts);
    }
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
        // If in thread mode, send as thread reply
        const threadTs = threadMode ? currentThreadTs : null;
        await sendMessage(currentChannelId, value, threadTs);
        statusBar.setContent(` Status: Message sent ${threadMode ? '(in thread) ' : ''}✓`);
        statusBar.style.fg = 'green';
        
        // Reload messages or thread replies
        if (threadMode) {
          const replies = await loadThreadReplies(currentChannelId, currentThreadTs);
          threadMessages = replies;
          displayThread(replies);
        } else {
          // Small delay to ensure Slack API consistency
          await new Promise(resolve => setTimeout(resolve, 300));

          const msgs = await loadMessages(currentChannelId, 50);
          messages = msgs;
          
          // Update selection to the new message (last one)
          selectedMessageIndex = messages.length - 1;
          
          displayMessages(messages);
          chatBox.setScrollPerc(100);
        }
        
        logInfo(`Message sent to channel ${currentChannelId}${threadMode ? ' (in thread)' : ''}`);
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
  searchBox.on('keypress', (ch, key) => {
    if (key.name === 'escape') {
      searchMode = false;
      searchQuery = '';
      searchBox.hide();
      searchBox.clearValue();
      updateView();
      channelList.focus();
      screen.render();
    }
  });

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

  // Global search box submission
  globalSearchBox.on('keypress', (ch, key) => {
    if (key.name === 'escape') {
      globalSearchMode = false;
      globalSearchBox.hide();
      globalSearchBox.clearValue();
      searchResultsBox.hide();
      chatBox.show();
      input.show();
      channelList.focus();
      screen.render();
    }
  });

  globalSearchBox.on('submit', async (value) => {
    const query = value.trim();
    
    if (query) {
      statusBar.setContent(` Status: Searching for "${query}"...`);
      screen.render();

      try {
        const results = await searchMessages(query);
        searchResults = results.matches;
        searchPage = results.page;
        searchTotalPages = results.page_count;

        if (searchResults.length === 0) {
          statusBar.setContent(` Status: No results found for "${query}"`);
          searchResultsBox.setItems(['No results found']);
        } else {
          displaySearchResults(searchResults, query);
          statusBar.setContent(` Status: Found ${results.total} results (Page ${searchPage}/${searchTotalPages})`);
        }

        globalSearchBox.hide();
        searchResultsBox.show();
        searchResultsBox.focus();
      } catch (error) {
        statusBar.setContent(` Status: Search failed - ${error.message}`);
        logError('Search failed', error);
      }
    }

    globalSearchBox.clearValue();
    screen.render();
  });

  // Search results selection
  searchResultsBox.on('select', async (item, index) => {
    const selectedResult = searchResults[index];
    if (selectedResult && selectedResult.channel_id) {
      // Load the channel where the message was found
      currentChannelId = selectedResult.channel_id;
      
      globalSearchMode = false;
      searchResultsBox.hide();
      chatBox.show();
      input.show();
      
      chatBox.setLabel(` Messages - # ${selectedResult.channel_name} `);
      
      try {
        const msgs = await loadMessages(currentChannelId);
        messages = msgs || [];
        displayMessages(messages);
        chatBox.focus();
        statusBar.setContent(` Status: Viewing # ${selectedResult.channel_name}`);
      } catch (error) {
        statusBar.setContent(` Status: Failed to load channel - ${error.message}`);
      }
      
      screen.render();
    }
  });

  // Join box input handler - show suggestions
  let joinSearchTimeout = null;
  joinBox.on('keypress', (ch, key) => {
    if (key.name === 'escape') {
      joinMode = false;
      joinBox.hide();
      joinBox.clearValue();
      suggestionsBox.hide();
      channelList.focus();
      screen.render();
      // Manually emit cancel to stop readInput if needed, though readInput handles escape internally
      joinBox.emit('cancel');
      return;
    }

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
    
    if (joinSearchTimeout) clearTimeout(joinSearchTimeout);

    joinSearchTimeout = setTimeout(() => {
      const query = joinBox.getValue().toLowerCase().trim();
      let needsRender = false;
      
      if (query.length > 0) {
        if (allPublicChannels.length === 0) {
           statusBar.setContent(' Status: Loading channels directory... please wait');
           needsRender = true;
        } else {
          const suggestions = allPublicChannels
            .filter(ch => ch.name.toLowerCase().includes(query))
            .slice(0, 10)
            .map(ch => {
               const memberCount = ch.num_members ? ` (${ch.num_members})` : '';
               return `# ${ch.name}${memberCount}`;
            });
          
          if (suggestions.length > 0) {
            suggestionsBox.setItems(suggestions);
            if (suggestionsBox.hidden) {
              suggestionsBox.show();
              suggestionsBox.setFront();
              needsRender = true;
            } else {
              // If items changed, we should render
              needsRender = true; 
            }
            statusBar.setContent(` Status: Found ${suggestions.length} matches for "${query}"`);
          } else {
            if (!suggestionsBox.hidden) {
              suggestionsBox.hide();
              needsRender = true;
            }
            statusBar.setContent(` Status: No channels found matching "${query}"`);
            needsRender = true; // Update status bar
          }
        }
      } else {
        if (!suggestionsBox.hidden) {
          suggestionsBox.hide();
          needsRender = true;
        }
        statusBar.setContent(' Status: Type to search public channels...');
        needsRender = true;
      }
      
      if (needsRender) {
        screen.render();
      }
    }, 100);
  });  // Join box handlers
  joinBox.on('submit', async (value) => {
    let channelName = value.trim();
    let channelId = null;
    
    // If suggestions are visible and a suggestion is selected, use that
    if (!suggestionsBox.hidden) {
      const selectedItem = suggestionsBox.getItem(suggestionsBox.selected);
      if (selectedItem) {
        // Extract name from format "# name (members)"
        const text = selectedItem.getText();
        const match = text.match(/^#\s+([^\s\(]+)/);
        if (match) {
            channelName = match[1];
        }
      }
    }
    
    // Find ID from the loaded channels list (case-insensitive)
    const channelObj = allPublicChannels.find(c => c.name.toLowerCase() === channelName.toLowerCase());
    if (channelObj) {
        channelId = channelObj.id;
        // Use the canonical name
        channelName = channelObj.name;
    }
    
    if (channelName) {
      if (!channelId) {
          statusBar.setContent(` Status: Error - Channel #${channelName} not found in directory`);
          statusBar.style.fg = 'red';
          joinBox.clearValue();
          channelList.focus();
          screen.render();
          return;
      }

      // Hide suggestions to clear view and prevent overlap
      suggestionsBox.hide();
      screen.render();

      // Ask for confirmation
      askConfirmation(`Are you sure you want to join #${channelName}?`, async (result) => {
        if (result) {
          // User confirmed
          joinMode = false;
          joinBox.hide();
          
          statusBar.setContent(` Status: Joining #${channelName}...`);
          screen.render();
          
          try {
            const { joinChannel } = await import('./user_client.js');
            // Pass ID
            const result = await joinChannel(channelId);
            
            if (result.success) {
              statusBar.setContent(` Status: Successfully joined #${channelName} ✓`);
              statusBar.style.fg = 'green';
              
              // Reload channels to show the newly joined channel
              if (reloadChannelsCallback) {
                await reloadChannelsCallback();
              } else if (global.reloadChannels) {
                await global.reloadChannels();
              }
              
              // If we have an ID, switch to it
              if (result.channel?.id || channelId) {
                 const newId = result.channel?.id || channelId;
                 currentChannelId = newId;
                 
                 // Switch to channels view if not already
                 if (currentView !== 'channels') {
                     currentView = 'channels';
                     updateButtonStyles();
                     updateView();
                 }
                 
                 // Load messages immediately
                 try {
                     const msgs = await loadMessages(currentChannelId);
                     messages = msgs;
                     displayMessages(msgs);
                     chatBox.setLabel(` Messages - # ${channelName} `);
                 } catch (e) {
                     logError('Failed to load messages after join', e);
                 }
              }
            } else {
              statusBar.setContent(` Status: Failed to join #${channelName} - ${result.error || 'Unknown error'}`);
              statusBar.style.fg = 'red';
            }
          } catch (error) {
            statusBar.setContent(` Status: Error joining channel - ${error.message}`);
            statusBar.style.fg = 'red';
            logError(`Failed to join channel ${channelName}`, error);
          }
          
          joinBox.clearValue();
          channelList.focus();
          screen.render();
        } else {
          // User cancelled
          joinBox.focus();
          joinBox.readInput(); // Re-enable input reading
          screen.render();
        }
      });
    } else {
      joinBox.clearValue();
      channelList.focus();
      screen.render();
    }
  });

  // User search box input handler - show suggestions
  userSearchBox.on('keypress', async (ch, key) => {
    if (key.name === 'escape') {
      userSearchMode = false;
      userSearchBox.hide();
      userSearchBox.clearValue();
      userSuggestionsBox.hide();
      channelList.focus();
      screen.render();
      return;
    }

    if (key.name === 'down' && !userSuggestionsBox.hidden) {
      userSuggestionsBox.down();
      screen.render();
      return;
    }
    if (key.name === 'up' && !userSuggestionsBox.hidden) {
      userSuggestionsBox.up();
      screen.render();
      return;
    }
    
    // Clear previous timeout
    if (userSearchTimeout) clearTimeout(userSearchTimeout);

    userSearchTimeout = setTimeout(async () => {
      const query = userSearchBox.getValue().trim();
      
      if (query.length >= 2) {
        try {
          const searchStatus = isUsersFullyLoaded ? '' : ' (Caching users...)';
          statusBar.setContent(` Status: Searching for "${query}"...${searchStatus}`);
          screen.render();
          
          const searchLower = query.toLowerCase();
          
          // Search in local cache
          const matchedUsers = allWorkspaceUsers.filter(u => {
            const name = (u.real_name || u.name || '').toLowerCase();
            const displayName = (u.profile?.display_name || '').toLowerCase();
            const username = (u.name || '').toLowerCase();
            const profileRealName = (u.profile?.real_name || '').toLowerCase();
            const email = (u.profile?.email || '').toLowerCase();
            
            return name.includes(searchLower) || 
                   displayName.includes(searchLower) || 
                   username.includes(searchLower) ||
                   profileRealName.includes(searchLower) ||
                   email.includes(searchLower);
          });
          
          if (matchedUsers.length > 0) {
            const suggestions = matchedUsers
              .slice(0, 10)
              .map(u => {
                const displayName = u.profile?.display_name || u.real_name || u.name;
                const status = u.profile?.status_emoji ? `${u.profile.status_emoji} ` : '';
                return `${status}${displayName} (@${u.name})`;
              });
            
            // Cache the matched users for selection
            allUsers = matchedUsers;
            
            userSuggestionsBox.setItems(suggestions);
            userSuggestionsBox.show();
            statusBar.setContent(` Status: Found ${matchedUsers.length} users${searchStatus}`);
          } else {
            userSuggestionsBox.hide();
            statusBar.setContent(` Status: No users found for "${query}"${searchStatus}`);
          }
        } catch (error) {
          userSuggestionsBox.hide();
          statusBar.setContent(` Status: Search error - ${error.message}`);
          logError('User search error', error);
        }
      } else {
        userSuggestionsBox.hide();
        statusBar.setContent(' Status: Type at least 2 characters to search...');
      }
      screen.render();
    }, 300); // Debounce search by 300ms (fast local search)
  });

  // User search box submit handler
  userSearchBox.on('submit', async (value) => {
    let selectedUser = null;
    
    // If suggestions are visible and a suggestion is selected, use that
    if (!userSuggestionsBox.hidden) {
      const selectedItem = userSuggestionsBox.getItem(userSuggestionsBox.selected);
      if (selectedItem) {
        const username = selectedItem.getText().match(/@([^\)]+)\)/)?.[1];
        if (username) {
          selectedUser = allUsers.find(u => u.name === username);
        }
      }
    }
    
    // Hide search UI immediately
    userSearchMode = false;
    userSearchBox.hide();
    userSuggestionsBox.hide();
    userSearchBox.clearValue();
    screen.render();
    
    if (selectedUser) {
      statusBar.setContent(` Status: Opening DM with ${selectedUser.real_name || selectedUser.name}...`);
      screen.render();
      
      try {
        const { getUserClient } = await import('./user_client.js');
        const client = getUserClient();
        
        // Open a DM conversation with the user
        const result = await client.conversations.open({
          users: selectedUser.id
        });
        
        if (result.ok && result.channel) {
          const dmChannelId = result.channel.id;
          
          // Switch to DMs view immediately
          currentView = 'dms';
          updateButtonStyles();
          
          // Select the DM channel
          currentChannelId = dmChannelId;
          const displayName = `💬 ${selectedUser.real_name || selectedUser.name}`;
          chatBox.setLabel(` Messages - ${displayName} `);
          
          // Force update view to show DMs list (even if not fully reloaded yet)
          updateView();
          screen.render();
          
          // Reload channels to include the new DM
          if (reloadChannelsCallback) {
            await reloadChannelsCallback();
          }
          
          // Re-select channel ID after reload (in case reload cleared it or something)
          currentChannelId = dmChannelId;
          updateView(); // Update view again to highlight the new channel in the list
          
          const msgs = await loadMessages(dmChannelId, 50);
          messages = msgs;
          selectedMessageIndex = messages.length - 1;
          displayMessages(msgs);
          chatBox.setScrollPerc(100);
          
          statusBar.setContent(` Status: DM opened with ${selectedUser.real_name || selectedUser.name} ✓`);
          statusBar.style.fg = 'green';
          
          input.focus();
          screen.render();
        } else {
          statusBar.setContent(` Status: Failed to open DM`);
          statusBar.style.fg = 'red';
        }
      } catch (error) {
        statusBar.setContent(` Status: Error opening DM - ${error.message}`);
        statusBar.style.fg = 'red';
        logError('Failed to open DM', error);
      }
    }
    
    screen.render();
  });

  userSearchBox.on('cancel', () => {
    userSearchMode = false;
    userSearchBox.hide();
    userSearchBox.clearValue();
    userSuggestionsBox.hide();
    channelList.focus();
    screen.render();
  });

  joinBox.on('cancel', () => {
    joinMode = false;
    joinBox.hide();
    suggestionsBox.hide();
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

  // Start caching users in background
  preloadUsers();

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
    
    // Reset selection when switching channels
    selectedMessageIndex = -1;
    
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
    channelsBtn.setContent('{center}> [F1] Channels | [Ctrl+F] Search | [F7] Join <{/center}');
    dmsBtn.setContent('{center}[F2] DMs | [F3] Activity{/center}');
  } else if (currentView === 'dms') {
    channelsBtn.setContent('{center}[F1] Channels{/center}');
    dmsBtn.setContent('{center}> [F2] DMs | [Ctrl+F] Search | [F3] Activity <{/center}');
  } else if (currentView === 'activity') {
    channelsBtn.setContent('{center}[F1] Channels{/center}');
    dmsBtn.setContent('{center}[F2] DMs | > [F3] Activity <{/center}');
  }
  screen.render();
}

function updateView() {
  let filteredChannels;
  
  if (currentView === 'activity') {
    chatBox.hide();
    threadBox.hide();
    globalSearchBox.hide();
    searchResultsBox.hide();
    activityBox.show();
    activityBox.focus();
    statusBar.setContent(' Status: Viewing Activity (Enter to jump to message)');
    screen.render();
    return;
  } else {
    activityBox.hide();
  }
  
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

// Helper function to escape blessed tags in text
function escapeText(text) {
  if (!text) return '';
  // Remove curly braces but preserve other formatting
  return text.replace(/\{/g, '').replace(/\}/g, '');
}

function wrapText(text, maxWidth) {
  if (!text) return [];
  const lines = [];
  const textLines = text.split('\n');
  
  for (const line of textLines) {
    if (line.length <= maxWidth) {
      lines.push(line);
      continue;
    }
    
    // Check if line contains a URL
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const hasUrl = urlRegex.test(line);
    
    if (hasUrl) {
      // Don't break URLs - keep them on one line
      lines.push(line);
    } else {
      // Word wrap for regular text
      let currentLine = '';
      const words = line.split(' ');
      
      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= maxWidth) {
          currentLine = currentLine ? currentLine + ' ' + word : word;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
    }
  }
  
  return lines;
}

function displayMessages(msgs) {
  if (!msgs || msgs.length === 0) {
    chatBox.setContent('No messages in this channel.');
    selectedMessageIndex = -1;
    return;
  }

  // Store messages - keep original order (oldest first)
  messages = [...msgs];
  
  // Validate and initialize selected message
  if (selectedMessageIndex === -1) {
    // First time - select newest message (last in array)
    selectedMessageIndex = messages.length - 1;
  } else if (selectedMessageIndex >= messages.length) {
    // Messages changed, adjust to newest
    selectedMessageIndex = messages.length - 1;
  }
  // If selectedMessageIndex is valid (0 to length-1), keep it

  const boxWidth = chatBox.width - 4; // Account for borders and padding
  const contentWidth = Math.max(50, boxWidth - 5); // Minimum width 50, leave space for box characters

  const formattedMessages = messages.map((msg, index) => {
    const timestamp = new Date(parseFloat(msg.ts) * 1000).toLocaleString();
    const username = msg.user_name || msg.username || 'Unknown';
    const imageIndicator = msg.has_images ? ' 📷' : '';
    const escapedText = escapeText(msg.text || '');
    
    // Highlight selected message
    const isSelected = index === selectedMessageIndex;
    const selectionMarker = isSelected ? '{yellow-fg}➤{/yellow-fg} ' : '  ';
    
    // Create message box
    const borderColor = isSelected ? 'yellow' : 'blue';
    const boxTop = `{${borderColor}-fg}┌${'─'.repeat(contentWidth)}┐{/${borderColor}-fg}`;
    const boxBottom = `{${borderColor}-fg}└${'─'.repeat(contentWidth)}┘{/${borderColor}-fg}`;
    
    // Format header line
    const headerLine = `{${borderColor}-fg}│{/${borderColor}-fg} ${selectionMarker}{cyan-fg}{bold}${escapeText(username)}{/bold}{/cyan-fg} {gray-fg}• ${timestamp}{/gray-fg}${imageIndicator}`;
    
    // Wrap message text to fit in box
    const wrappedLines = wrapText(escapedText, contentWidth - 5);
    const textLines = wrappedLines.map(line => 
      `{${borderColor}-fg}│{/${borderColor}-fg}   ${line}`
    ).join('\n');
    
    // Thread indicator on separate line if present
    let threadLine = '';
    if (msg.reply_count && msg.reply_count > 0) {
      threadLine = `\n{${borderColor}-fg}│{/${borderColor}-fg}\n{${borderColor}-fg}│{/${borderColor}-fg}   {magenta-fg}💬 ${msg.reply_count} ${msg.reply_count === 1 ? 'reply' : 'replies'}{/magenta-fg}`;
    }
    
    return `${boxTop}\n${headerLine}\n{${borderColor}-fg}│{/${borderColor}-fg}\n${textLines}${threadLine}\n${boxBottom}`;
  }).join('\n');

  chatBox.setContent(formattedMessages);
  
  // Scroll to keep selected message visible
  if (selectedMessageIndex === messages.length - 1) {
    // Most recent message - scroll to bottom
    chatBox.setScrollPerc(100);
  } else if (selectedMessageIndex === 0) {
    // Oldest message - scroll to top
    chatBox.setScrollPerc(0);
  } else {
    // Calculate scroll position to keep selected message in view
    const scrollPercent = (selectedMessageIndex / (messages.length - 1)) * 100;
    chatBox.setScrollPerc(scrollPercent);
  }
  
  screen.render();
}

async function viewThread(threadTs) {
  if (!currentChannelId || !threadTs) return;
  
  try {
    statusBar.setContent(' Status: Loading thread...');
    screen.render();
    
    const replies = await loadThreadReplies(currentChannelId, threadTs);
    threadMessages = replies;
    currentThreadTs = threadTs;
    threadMode = true;
    
    displayThread(replies);
    
    chatBox.hide();
    threadBox.show();
    threadBox.focus();
    
    statusBar.setContent(` Status: Viewing thread (${replies.length} messages) - Press Esc to close`);
    screen.render();
  } catch (error) {
    statusBar.setContent(` Status: Failed to load thread - ${error.message}`);
    logError('Failed to load thread', error);
    screen.render();
  }
}

function displayThread(replies) {
  if (!replies || replies.length === 0) {
    threadBox.setContent('No replies in this thread.');
    return;
  }

  const formattedReplies = replies.map((msg, index) => {
    const timestamp = new Date(parseFloat(msg.ts) * 1000).toLocaleString();
    const username = msg.user_name || msg.username || 'Unknown';
    const imageIndicator = msg.has_images ? ' 📷' : '';
    const isParent = index === 0;
    const prefix = isParent ? '📌 ' : '  ↳ ';
    const escapedText = escapeText(msg.text || '');
    return `${prefix}[${timestamp}] {blue-fg}{bold}${escapeText(username)}{/bold}{/blue-fg}:${imageIndicator} ${escapedText}`;
  }).join('\n\n');

  threadBox.setContent(formattedReplies);
  threadBox.setScrollPerc(100);
  screen.render();
}

function displaySearchResults(results, query) {
  const formattedResults = results.map(result => {
    const timestamp = new Date(parseFloat(result.ts) * 1000).toLocaleString();
    const userName = result.user_name || 'Unknown';
    const channelName = result.channel_name || 'Unknown';
    const imageIndicator = result.has_images ? ' 📷' : '';
    
    // Escape text first, then highlight
    let text = escapeText(result.text || '');
    
    // Escape regex special characters in query
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const highlightedText = text.replace(
      new RegExp(`(${escapedQuery})`, 'gi'),
      '{yellow-fg}{bold}$1{/bold}{/yellow-fg}'
    );
    
    return `[${timestamp}] {cyan-fg}#${escapeText(channelName)}{/cyan-fg} | {blue-fg}{bold}${escapeText(userName)}{/bold}{/blue-fg}:${imageIndicator} ${highlightedText}`;
  });

  searchResultsBox.setItems(formattedResults);
  searchResultsBox.select(0);
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
      const newMessages = [...olderMessages, ...messages];
      messages = newMessages;
      
      const formattedMessages = messages.map(msg => {
        const timestamp = new Date(parseFloat(msg.ts) * 1000).toLocaleString();
        const username = msg.user_name || msg.username || 'Unknown';
        const imageIndicator = msg.has_images ? ' 📷' : '';
        const escapedText = escapeText(msg.text || '');
        return `[${timestamp}] {blue-fg}{bold}${escapeText(username)}{/bold}{/blue-fg}:${imageIndicator} ${escapedText}`;
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
    
    // Calculate available space for image - FULL SCREEN
    const availableWidth = screen.width;
    const availableHeight = screen.height;

    const imageText = await getCachedImage(imageUrl, token, {
      width: availableWidth,
      height: availableHeight
    });
    
    const imageInfo = `File: ${imageFile.name} | Size: ${(imageFile.size / 1024).toFixed(1)} KB`;
    
    // Update info overlay
    if (imageViewer.infoBox) {
      imageViewer.infoBox.setContent(` {bold}${imageInfo}{/bold} | Press Esc to close | O to open in browser`);
    }
    
    imageViewer.setContent(imageText);
    imageViewer.show();
    imageViewer.focus();
    
    // Store current image URL for browser opening
    imageViewer.currentImageUrl = imageFile.permalink || imageFile.url_private;
    
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

async function preloadUsers() {
  try {
    const { getUserClient } = await import('./user_client.js');
    const client = getUserClient();
    let cursor = undefined;
    let totalLoaded = 0;
    
    // Don't show status immediately to avoid cluttering startup
    // But start fetching
    
    do {
      const result = await client.users.list({
        limit: 1000,
        cursor: cursor
      });

      const users = (result.members || []).filter(u => 
        !u.is_bot && !u.deleted && u.id !== 'USLACKBOT'
      );

      allWorkspaceUsers = allWorkspaceUsers.concat(users);
      totalLoaded += users.length;
      
      // Update status if we are in user search mode
      if (userSearchMode) {
        statusBar.setContent(` Status: Caching users... (${totalLoaded} loaded)`);
        screen.render();
      }

      cursor = result.response_metadata?.next_cursor;
      
      // 2s delay to avoid rate limits (Tier 2: 20 req/min)
      if (cursor) await new Promise(r => setTimeout(r, 2000));
      
    } while (cursor);
    
    isUsersFullyLoaded = true;
    if (userSearchMode) {
      statusBar.setContent(` Status: User cache complete (${allWorkspaceUsers.length} users)`);
      screen.render();
    }
    logInfo(`User cache complete: ${allWorkspaceUsers.length} users`);
    
  } catch (error) {
    logError('Failed to preload users', error);
  }
}

async function loadActivity() {
  const userId = await getCurrentUserId();
  if (!userId) {
    activityBox.setItems(['Error: Could not identify current user.']);
    screen.render();
    return;
  }
  
  activityBox.setLabel(' Activity: Loading... ');
  screen.render();
  
  try {
    // Search for mentions of the user
    const result = await searchMessages(`<@${userId}>`, { count: 20 });
    
    if (!result.matches || result.matches.length === 0) {
      activityBox.setItems(['No recent mentions found.']);
      activityBox.setLabel(' Activity ');
      activityMatches = [];
      screen.render();
      return;
    }
    
    activityMatches = result.matches;
    
    const items = activityMatches.map(match => {
      const time = new Date(parseFloat(match.ts) * 1000).toLocaleString();
      const channelName = match.channel_name || match.channel?.name || 'Unknown';
      const userName = match.user_name || match.username || 'Unknown';
      // Clean up text for preview
      let text = (match.text || '').replace(/\n/g, ' ').substring(0, 80);
      if ((match.text || '').length > 80) text += '...';
      
      const typeLabel = match.thread_ts ? ' {cyan-fg}(Thread){/cyan-fg}' : '';
      
      // Format: [Channel] User: Message (Time)
      return `{magenta-fg}#${escapeText(channelName)}{/magenta-fg}${typeLabel} {bold}${escapeText(userName)}{/bold}: ${escapeText(text)} {gray-fg}(${time}){/gray-fg}`;
    });
    
    activityBox.setItems(items);
    activityBox.setLabel(` Activity (${result.total} mentions) `);
    screen.render();
    
  } catch (error) {
    activityBox.setItems([`Error loading activity: ${error.message}`]);
    activityBox.setLabel(' Activity (Error) ');
    logError('Activity load failed', error);
  }
}