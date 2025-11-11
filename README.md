# Golem.de Article Merger Userscript

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A userscript that enhances [Golem.de](https://www.golem.de/) by merging its paginated articles into a single, continuous page for a seamless reading experience.

## Features

- **Merge Pages**: Combines all pages of an article into one.
- **Multiple Merge Modes**:
  - **In-place**: Merges content directly into the current page.
  - **New Tab**: Opens the fully merged article in a clean, reader-friendly new tab.
  - **Readwise**: Sends the complete article directly to your [Readwise](https://readwise.io/) account for archiving and review (requires an access token).
- **Intelligent Activation**: Only activates on articles detected to have multiple pages, preventing unnecessary UI elements on single-page content.
- **Content Cleanup**: Removes ads, social media buttons, and other non-essential elements from the merged content.
- **Settings Menu**: A simple UI to manage your Readwise token.
- **Auto-Update**: The script can automatically update itself if you install it from the GitHub URL.

## Installation

1.  **Get a Userscript Manager**: You need a browser extension that can run userscripts. Popular choices include:
    - [Tampermonkey](https://www.tampermonkey.net/) (for Chrome, Firefox, Edge, Safari)
    - [Greasemonkey](https://www.greasespot.net/) (for Firefox)
    - [FireMonkey](https://addons.mozilla.org/en-US/firefox/addon/firemonkey/) (for Firefox)

2.  **Install the Script**: Click the installation link below. Your userscript manager will detect it and ask for confirmation.

    [**Click here to install**](https://raw.githubusercontent.com/mndfcked/golem-de-merger-userscript/main/golem-onepager.user.js)

## Usage

Once installed, navigate to any multi-page article on `golem.de`. A set of buttons will appear at the bottom-right of the page *only if the article is detected to have multiple pages*:

- **Merge pages**: Merges the article content directly into the current page.
- **Merge → new tab**: Opens the complete, cleaned-up article in a new browser tab.
- **Merge → Readwise**: Sends the article to your Readwise account. The first time you use this, you will be prompted for your [Readwise Access Token](https://readwise.io/access_token).
- **⚙️**: Opens a settings menu where you can set, change, or clear your Readwise token.

### Configuration

You can edit the script in your userscript manager to change the following setting:

- `AUTO_MERGE`: Set this to `true` at the top of the script to automatically merge articles in-place as soon as you load a page.

## Compatibility

This script is tested and works with modern browsers and userscript managers. It is designed to be compatible with both synchronous and asynchronous storage APIs found in different managers (e.g., Tampermonkey vs. Greasemonkey 4+).

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
