# ig-activity-cleaner

A Tampermonkey userscript to clean up your Instagram activity from the browser:

- **Unlike everything** (posts and reels)
- **Delete all your comments**
- **Unsend your direct messages** in a conversation
- **Delete a chat on your side**

One script, one menu. Everything runs in your own Instagram session, on the official "Your activity" page. No server, no hidden API, and your password is never requested.

---

## Features

- Automatic selection and deletion, in batches of 20
- Automatically confirms Instagram's dialog
- Random pause between batches, adjustable right from the panel
- Pause setting saved across page reloads
- Auto-reloads the page to keep going until the last item
- Start / Stop button and live counter
- Tabs to switch between modes on each page
- Built-in safety: never clicks anything containing "Report", "Block" or "Restrict" (FR + EN), and stops immediately if it meets one
- Works with Instagram in English or French
- Clean floating menu, draggable and collapsible
- Menu available in English and French (switch anytime, choice is saved)
- Console logs (`[IG Cleaner]`) to see where things get stuck

## Script

`instagram-activity-cleaner.user.js` handles everything. The menu only shows up on the pages below.

| Tab | What it does | Page |
|---|---|---|
| ♥ Likes | Removes all your likes | `instagram.com/your_activity/interactions/likes` |
| 💬 Comments | Deletes all your comments | `instagram.com/your_activity/interactions/comments` |
| ↩ Unsend | Unsends **your** messages in the open chat, for both sides | Any chat: `instagram.com/direct/t/…` |
| 🗑 Delete chat | Deletes the whole chat **on your side only** | Any chat: `instagram.com/direct/t/…` |

> **About the other person's messages:** Instagram does not let anyone delete someone else's messages on their side. "Delete chat" only removes the conversation from *your* inbox. The other person keeps everything.

### How Unsend stays safe

For each message, the script hovers it, opens its **More** menu and looks for **Unsend**. If the menu has no Unsend (it's the other person's message), it closes the menu with Escape and moves on. The only buttons it may ever click are **More**, **Unsend** and the **Unsend** confirmation.

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension (Chrome, Brave, Edge, Firefox…).
2. Open `instagram-activity-cleaner.user.js` in this repo and click **Raw**: Tampermonkey will offer to install it.
   Or: Tampermonkey → **Create a new script** → paste the code → **Save**.

> On Chrome and Brave, you may need to turn on **Developer mode** in `chrome://extensions` for userscripts to run.

## Usage

1. Log in to Instagram on desktop.
2. Open one of the pages above (for DMs: open the chat you want to clean).
3. A menu appears in the bottom-right corner. Use the tabs to pick what to do.
4. Set the pause if you want (in seconds), then click **Start**.
5. Keep the tab open. Click **Stop** at any time.

## Tips

- **Deletions are permanent.** Removed likes, comments and unsent messages can't be restored.
- **Delete chat asks for confirmation** before doing anything.
- **Instagram rate-limits actions.** Going too fast can get your account temporarily blocked for a few hours. If that happens, stop the script and increase the pause (e.g. 30 to 60 seconds).
- For large amounts, run several short sessions instead of one very long one.

## Troubleshooting

Items get checked but nothing is deleted? Or the panel doesn't show up?

1. Press **F12** and open the **Console** tab.
2. Look for lines starting with `[IG Cleaner]`.
3. Open an issue with those lines and a screenshot of the bottom bar.

Instagram changes its site often. The scripts find buttons by their text, but an Instagram update can still break them.

## Disclaimer

This project is not affiliated with Instagram or Meta. It automates clicks on your own account, which may go against Instagram's Terms of Use. Use at your own risk.

## License

[MIT](LICENSE)

---

Made with ❤ by Timothée Meuwly
