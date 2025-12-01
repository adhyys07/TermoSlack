export const themes = {
  default: {
    name: 'Default',
    primary: { fg: 'white', bg: 'black' },
    secondary: { fg: 'gray', bg: 'black' },
    border: { fg: 'white', bg: 'black' },
    selected: { fg: 'black', bg: 'white' },
    item: { fg: 'white', bg: 'black' },
    header: { fg: 'white', bg: 'black', bold: true },
    message: {
      user: 'cyan',
      time: 'gray',
      text: 'white',
      border: 'blue',
      selectedBorder: 'yellow',
      selectionMarker: 'yellow'
    },
    input: { fg: 'white', bg: 'black', border: 'white' },
    scrollbar: { bg: 'white', fg: 'blue' },
    tags: {
      user: '{cyan-fg}',
      time: '{gray-fg}',
      channel: '{magenta-fg}',
      thread: '{cyan-fg}',
      attachment: '{green-fg}',
      reset: '{/}'
    }
  },
  hacker: {
    name: 'Hacker',
    primary: { fg: 'green', bg: 'black' },
    secondary: { fg: 'green', bg: 'black' },
    border: { fg: 'green', bg: 'black' },
    selected: { fg: 'black', bg: 'green' },
    item: { fg: 'green', bg: 'black' },
    header: { fg: 'green', bg: 'black', bold: true },
    message: {
      user: 'green',
      time: 'green',
      text: 'green',
      border: 'green',
      selectedBorder: 'white',
      selectionMarker: 'white'
    },
    input: { fg: 'green', bg: 'black', border: 'green' },
    scrollbar: { bg: 'green', fg: 'black' },
    tags: {
      user: '{green-fg}',
      time: '{green-fg}',
      channel: '{green-fg}',
      thread: '{white-fg}',
      attachment: '{white-fg}',
      reset: '{/}'
    }
  },
  light: {
    name: 'Light',
    primary: { fg: 'black', bg: 'white' },
    secondary: { fg: 'gray', bg: 'white' },
    border: { fg: 'black', bg: 'white' },
    selected: { fg: 'white', bg: 'blue' },
    item: { fg: 'black', bg: 'white' },
    header: { fg: 'black', bg: 'white', bold: true },
    message: {
      user: 'blue',
      time: 'gray',
      text: 'black',
      border: 'black',
      selectedBorder: 'blue',
      selectionMarker: 'blue'
    },
    input: { fg: 'black', bg: 'white', border: 'black' },
    scrollbar: { bg: 'gray', fg: 'black' },
    tags: {
      user: '{blue-fg}',
      time: '{gray-fg}',
      channel: '{red-fg}',
      thread: '{blue-fg}',
      attachment: '{blue-fg}',
      reset: '{/}'
    }
  },
  ocean: {
    name: 'Ocean',
    primary: { fg: 'white', bg: 'blue' },
    secondary: { fg: 'cyan', bg: 'blue' },
    border: { fg: 'cyan', bg: 'blue' },
    selected: { fg: 'blue', bg: 'white' },
    item: { fg: 'white', bg: 'blue' },
    header: { fg: 'white', bg: 'blue', bold: true },
    message: {
      user: 'white',
      time: 'cyan',
      text: 'white',
      border: 'cyan',
      selectedBorder: 'white',
      selectionMarker: 'white'
    },
    input: { fg: 'white', bg: 'blue', border: 'cyan' },
    scrollbar: { bg: 'cyan', fg: 'blue' },
    tags: {
      user: '{white-fg}',
      time: '{cyan-fg}',
      channel: '{yellow-fg}',
      thread: '{cyan-fg}',
      attachment: '{yellow-fg}',
      reset: '{/}'
    }
  }
};

export let currentTheme = themes.default;

export function setTheme(themeName) {
  if (themes[themeName]) {
    currentTheme = themes[themeName];
    return true;
  }
  return false;
}

export function getTheme() {
  return currentTheme;
}

export function cycleTheme() {
  const themeNames = Object.keys(themes);
  const currentIndex = themeNames.indexOf(Object.keys(themes).find(key => themes[key] === currentTheme));
  const nextIndex = (currentIndex + 1) % themeNames.length;
  currentTheme = themes[themeNames[nextIndex]];
  return currentTheme;
}
