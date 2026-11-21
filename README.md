# instagram-unlike-script

Tampermonkey userscripts to clean up your Instagram activity from the browser:

- **Unlike everything** (posts and reels)
- **Delete all your comments**

Everything runs in your own Instagram session, on the official "Your activity" page. No server, no hidden API, and your password is never requested.

---

## Features

- Automatic selection and deletion, in batches of 20
- Automatically confirms Instagram's dialog
- Random pause between batches, adjustable right from the panel
- Pause setting saved across page reloads
- Auto-reloads the page to keep going until the last item
- Start / Stop button and live counter
- Works with Instagram in English or French
- Console logs (`[IG Cleaner]`) to see where things get stuck

## Scripts

| File | What it does | Page |
|---|---|---|
| `instagram-unlike-all.user.js` | Removes all your likes | `instagram.com/your_activity/interactions/likes` |
| `instagram-delete-comments.user.js` | Deletes all your comments | `instagram.com/your_activity/interactions/comments` |

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension (Chrome, Brave, Edge, Firefox…).
2. Open a `.user.js` file in this repo and click **Raw**: Tampermonkey will offer to install it.
   Or: Tampermonkey → **Create a new script** → paste the code → **Save**.
3. Repeat for the second script if you need it.

> On Chrome and Brave, you may need to turn on **Developer mode** in `chrome://extensions` for userscripts to run.

## Usage

1. Log in to Instagram on desktop.
2. Open the page that matches the script (see the table above).
3. A black panel appears in the bottom-right corner.
4. Set the pause if you want (in seconds), then click **Démarrer** (Start).
5. Keep the tab open. Click **Arrêter** (Stop) at any time.

## Tips

- **Deletions are permanent.** Removed likes and comments can't be restored.
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
