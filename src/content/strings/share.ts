// Strings for keeping and sharing a finished life (SHARE-001, SHARE-002): the panel on the summary screen, the text
// that is copied and the words on the picture. Nothing here names the player; the person is fictional.
export const shareStrings: Readonly<Record<string, string>> = {
  "share.heading": "Keep this life",
  "share.about":
    "Copy a few lines about this life, or save its rings as a picture. Both are made here in your browser; nothing is sent anywhere, and you choose where they go. The text can serve as the picture's description.",
  "share.copy": "Copy as text",
  "share.copied": "Copied the text about {name}.",
  "share.copyFailed": "Your browser would not copy the text. It is shown here: select it and copy it yourself.",
  "share.textLabel": "Show the text",
  "share.select": "Select the text",
  "share.selected": "The text is selected. Copy it with your keyboard.",
  "share.image": "Save the rings as an image",
  "share.imageSaved": "Saved the picture as {fileName}, in your downloads.",
  "share.imageFailed": "Your browser could not make the picture.",

  "share.text.who": "{name}: {country}, {born} to {died}.",
  "share.text.diedAt": "Died at {age}.",
  "share.text.diedInfant": "Died in the first year of life.",
  "share.text.diedInfantOf": "Died in the first year of life, of {cause}.",
  "share.text.expectancy.shorter":
    "In {country}, {someone} can expect to live about {expected}. This life was {difference} shorter.",
  "share.text.expectancy.similar":
    "In {country}, {someone} can expect to live about {expected}. This life was about as long.",
  "share.text.expectancy.longer":
    "In {country}, {someone} can expect to live about {expected}. This life was {difference} longer.",
  "share.text.shaped":
    "What shaped it, as this game reckons it: {circumstance} circumstance, {choice} choice and {chance} chance.",
  "share.text.epitaph": "“{epitaph}”",
  "share.text.about": "Drawn by the odds of birth, in Birthright, a free life simulation that runs in your browser:",
  "share.text.seed": "Seed: {seed}",

  "share.card.shaped": "{circumstance} circumstance · {choice} choice · {chance} chance",
  "share.card.footer": "{title}: {subtitle}",
  "share.card.title": "{name}'s life in rings",
  "share.card.label": "The rings of {name}'s life: {years}, {country}, {born} to {died}.",
};
