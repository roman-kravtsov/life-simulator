// Text for the M5 screens: the yearly plan, the decision card with its odds lens, help resources,
// the settings and the line for years that pass quietly.
export const uiStrings: Readonly<Record<string, string>> = {
  // The yearly plan (DEC-003, DEC-004).
  "plan.heading": "Where your attention goes",
  "plan.intro":
    "You have {points} to place this year. Your choices carry over from year to year until you change them.",
  "plan.following": "Until you change it, your points follow what suits your situation.",
  "plan.carried": "These are the points you set. They stay as they are until you change them.",
  "plan.points.one": "{count} point",
  "plan.points.other": "{count} points",
  "plan.area.learn": "Learn",
  "plan.area.earn": "Earn",
  "plan.area.health": "Health",
  "plan.area.belonging": "Belonging",
  "plan.area.rest": "Rest",
  "plan.what.learn": "Skills and school.",
  "plan.what.earn": "Income and work.",
  "plan.what.health": "Health and care.",
  "plan.what.belonging": "Family, friends and community.",
  "plan.what.rest": "Happiness and resilience.",
  "plan.forced.heading": "Already taken",
  "plan.forced.line": "{area}, {points}. {reason}",
  "plan.forced.illness": "Your illness takes it first.",
  "plan.forced.childLabour": "The household needs your work, and that comes first.",
  "plan.forced.caregiving": "Someone in your family needs looking after, and that comes first.",
  "plan.forced.note": "{points} already taken.",
  "plan.locked.tooYoung": "You are too young for paid work.",
  "plan.locked.retired": "You have retired from work.",
  "plan.left.one": "{count} point left to place. It goes to Rest if you leave it.",
  "plan.left.other": "{count} points left to place. They go to Rest if you leave them.",
  "plan.left.none": "All points placed.",

  // Decisions (DEC-001, DEC-002, DEC-005).
  "decision.heading": "A decision",
  "decision.waiting": "A decision is waiting.",
  "decision.choices": "Your choices",
  "decision.locked": "Not open to you: {reason}",
  "decision.cost.once": "Costs {amount} (international dollars).",
  "decision.cost.perYear": "Costs {amount} each year (international dollars).",
  "decision.chose": "You chose: {choice}",
  "lens.vs": "{line}, otherwise {odds}",
  "odds.almostNever": "almost never",
  "odds.almostSure": "almost sure",
  "odds.fraction": "about {num} in {den}",

  // Years that pass in one step (TIME-002).
  "life.quietRun.one": "The year you turn {age} passes quietly.",
  "life.quietRun.other": "Years {from} to {to} pass quietly.",

  // Settings (EVENT-006, TIME-002).
  "settings.heading": "How you want to play",
  "settings.softening": "Softer telling",
  "settings.softening.about": "Leaves out the hardest events and tells hard ones more briefly.",
  "settings.pace": "Skip quiet years",
  "settings.pace.about": "Years with nothing to decide or tell pass in one step.",

  // The settings screen and how the page looks (UI-009, UI-011, A11Y-004, A11Y-005).
  "settingsScreen.title": "Settings",
  "settingsScreen.play.about":
    "For the lives you begin from now. A life in progress keeps its own, which you can change from its Settings button.",
  "settingsScreen.stored": "What is stored on this device",
  "settingsScreen.stored.about":
    "Your lives and these settings are kept in this browser only. Nothing is tracked or sent anywhere.",
  "settingsScreen.back": "Back",
  "display.heading": "How it looks",
  "display.theme": "Theme",
  "display.theme.about": "System follows the light or dark setting of this device.",
  "display.theme.system": "System",
  "display.theme.light": "Light",
  "display.theme.dark": "Dark",
  "display.textSize": "Text size",
  "display.textSize.about": "On top of the text size set in your browser.",
  "display.textSize.default": "Default",
  "display.textSize.large": "Larger",
  "display.textSize.larger": "Largest",
  "display.motion": "Reduce motion",
  "display.motion.about":
    "Holds back movement, such as the growth rings drawing themselves. Until you change it, it follows this device.",

  // First-life hints (UI-015).
  "hint.label": "A hint",
  "hint.dismiss": "Got it",
  "hint.plan":
    "Each year you place a few points of attention across five areas. They shift the odds of what the year brings and never settle them. Leave them be and they follow what suits your situation.",
  "hint.decision":
    "Now and then the year stops and asks you something. It waits for as long as you like. A choice that is closed to you stays in view and says why.",
  "hint.lens":
    "Where a choice has odds, they are put in words under it. A choice can tilt them, and it never decides which way things fall.",
  "hints.heading": "Hints",
  "hints.about":
    "The first time you meet the plan, a decision or the odds, a short note explains it. A note goes when you put it away or act on it, and this brings them all back.",
  "hints.again": "Show the hints again",
  "hints.again.done": "The hints will show again.",

  // Help (UI-012).
  "help.talk": "Need to talk?",
  "help.newTab": "Free helplines directory. Opens in a new tab.",

  // Saved lives (SAVE-001 to SAVE-003, SAVE-007).
  "start.resume.heading": "Continue your life",
  "start.resume.line": "{name}, {age}, in {country}",
  "start.resume.lineNoPlace": "{name}, {age}",
  "start.resume.unknown": "A life is in progress.",
  "start.resume.note": "Beginning a new life replaces this one.",
  "start.resume.continue": "Continue",
  "start.problem.unsupported": "A saved life could not be opened: it was made by a newer version of the game.",
  "start.problem.damaged": "A saved life could not be opened: its file is damaged.",
  "start.problem.unreadable": "A saved life could not be opened: this browser would not let the game read it.",
  "start.problem.discard": "Discard it",
  "start.past": "Past lives",

  "past.title": "Past lives",
  "past.intro": "The lives you have finished are kept here, in this browser only.",
  "past.loading": "Loading your past lives…",
  "past.empty": "No lives yet. When a life ends, it is kept here.",
  "past.line": "Born {born} in {country}. Died at {age}, of {cause}.",
  "past.finished": "Finished {date}",
  "past.open": "Open",
  "past.openLabel": "Open the life of {name}",
  "past.delete": "Delete",
  "past.deleteLabel": "Delete the life of {name}",
  "past.deleteConfirm.title": "Delete the life of {name}?",
  "past.deleteConfirm.body": "This life will be removed from this browser. It cannot be undone.",
  "past.deleteConfirm.yes": "Delete this life",
  "past.deleteConfirm.no": "Keep it",
  "past.deleteAll": "Delete all local data",
  "past.deleteAll.about": "Removes everything this game keeps in your browser.",
  "past.deleteAll.nothing": "There is nothing stored yet.",
  "past.deleteAll.title": "Delete all local data?",
  "past.deleteAll.body":
    "This removes every past life, the life in progress and the choices you made here, such as light or dark, from this browser. Nothing is kept anywhere else, so it cannot be undone.",
  "past.deleteAll.yes": "Delete everything",
  "past.deleteAll.no": "Keep everything",
  "past.problem":
    "Some lives could not be saved to or read from this browser's storage. It may be full, blocked or turned off.",

  // Notes on the life screen about its saved copy.
  "life.restored.replayed": "Your life was rebuilt from its seed after the saved copy could not be read.",
  "life.restored.inexact":
    "The game has been updated since this life was saved, so it may play out a little differently from here.",
  "life.problem.current": "This life could not be saved in your browser. If you close this tab, it will be lost.",
  "life.restored.both":
    "The saved copy of your life could not be read, so it was rebuilt from its seed. The game has also been updated since the life was saved, so it may play out a little differently from here.",

  // Lives as files: saving one to keep or carry, loading one back (SAVE-006).
  "files.about":
    "A life can be saved to a file, to keep it, or to load it in another browser, or in this one after its data has been cleared. A file holds the whole life, including anything you wrote in it. The game sends nothing anywhere: the file goes only where your browser saves downloads.",
  "files.current.save": "Save the life in progress to a file",
  "files.current.none": "There is no life in progress to save.",
  "files.saved": "Saved as {fileName}, in your downloads.",
  "files.savedPast": "The life of {name} was saved as {fileName}, in your downloads.",
  "files.saveFailed": "Your browser would not save the file. Downloads may be blocked or turned off.",
  "files.past.save": "Save to file",
  "files.past.saveLabel": "Save to file: the life of {name}",
  "files.load": "Load a life from a file",
  "files.loaded.current": "You can now continue {name}, {age}, from the start screen.",
  "files.loaded.past": "{name}'s life, lived to {age}, is in your past lives.",
  "files.loaded.pastKept":
    "{name}'s life was already in your past lives, with everything the file has, so nothing changed.",
  "files.inexact":
    "It was saved with other data or an older version of the game, so it may play out a little differently from here.",
  "files.fail.tooBig": "That file is too large to be a saved life.",
  "files.fail.unreadable": "That file could not be read as a life. It should be the .json file this game saved.",
  "files.fail.damaged":
    "That file is not a life this game can read. It may be damaged, or it may not be from this game.",
  "files.fail.unsupported":
    "That life was saved by a newer version of the game. Reload the page to get the newest version, then try again.",
  "files.fail.country":
    "This game has no data for the country that life was lived in, or the data could not be loaded just now. If it is the data, try again in a moment.",
  "files.fail.storage": "Your browser would not keep the life. The file is fine: make room and try again.",
  "files.replace.title": "Replace the life in progress?",
  "files.replace.body":
    "You have a life in progress. Loading {name}'s life replaces it, and it cannot be brought back unless you have saved it to a file.",
  "files.replace.bodyOf":
    "You have a life in progress: {current}, {age}. Loading {name}'s life replaces it, and it cannot be brought back unless you have saved it to a file.",
  "files.fail.finished":
    "That file is an earlier copy of a life that was since lived to its end in this browser. It is in your past lives, so nothing was loaded.",
  "files.replace.yes": "Replace it",
  "files.replace.no": "Keep it",

  "start.deleted": "All local data in this browser was deleted.",
  "past.deleted": "The life of {name} was deleted.",
  "past.deleteFailed":
    "The life of {name} could not be deleted. This browser's storage may be full, blocked or turned off.",
  "past.deleteAll.failed":
    "Your local data could not be deleted. This browser's storage may be full, blocked or turned off.",

  // The life screen: header, side columns, tabs, the ledger of years (UI-004, UI-010).
  "life.continue.short": "Continue",
  "life.continue.wait": "Answer the decision first.",
  "life.journal": "Journal",
  "life.settings": "Settings",
  "life.settings.close": "Close",
  "life.who.line": "Age {age} \u00b7 {where}",
  "life.strip.birth": "Birth",
  "life.strip.end": "about {age}",
  "life.strip.label": "Your life so far: you are {age} of about {end}. Dots mark key events.",
  "life.nav.label": "Parts of this screen",
  "life.nav.story": "Story",
  "life.nav.you": "You",
  "life.nav.around": "Around you",
  "life.you.aria": "About you",
  "life.you.heading": "You",
  "life.you.rings.none": "No rings yet",
  "life.you.rings.one": "{count} year, one ring each",
  "life.you.rings.other": "{count} years, one ring each",
  "life.stat.meter": "{stat} {value}, {band}",
  "life.statBand.very-low": "very low",
  "life.statBand.low": "low",
  "life.statBand.fair": "fair",
  "life.statBand.good": "good",
  "life.statBand.very-good": "very good",
  "life.tabs.you": "Your situation",
  "life.tab.school": "School & work",
  "life.tab.money": "Money",
  "life.tab.health": "Health",
  "conditions.none": "No lasting health conditions.",
  "life.around": "Around you",
  "life.tabs.around": "More about your world",
  "life.tab.family": "Family",
  "life.tab.country": "Country",
  "life.tab.notes": "Notes",
  "life.earlier": "Earlier years",
  "life.now": "now",
  "country.intro": "What the data the game draws on say about {country}.",
  "country.lifeExpectancy.female": "Life expectancy at birth, for women",
  "country.lifeExpectancy.male": "Life expectancy at birth, for men",
  "country.lifeExpectancy.value": "about {years}",
  "country.upperSecondary.female": "Women who finish upper secondary school",
  "country.upperSecondary.male": "Men who finish upper secondary school",
  "country.income": "Each person in a middle household, a day (international dollars)",
  "country.source": "{source}, {year}",
  "country.none": "The game has no measured figures for this country to show here.",

  // The stats that moved over the step just taken, said to a screen reader in the story's live region (A11Y-002).
  "life.statChange.rose.one": "{stat} rose by {count}.",
  "life.statChange.rose.other": "{stat} rose by {count}.",
  "life.statChange.fell.one": "{stat} fell by {count}.",
  "life.statChange.fell.other": "{stat} fell by {count}.",

  // A large family in the Family tab: the rest are one press away (UI-004).
  "family.more.one": "And {count} more person",
  "family.more.other": "And {count} more people",
  "family.all.title": "Everyone in your life",
  "family.all.close": "Close",

  // Reflection prompts and the journal (UI-007, SUM-005). Always optional: nothing here asks for an answer.
  "reflection.heading": "A pause",
  "journal.left.one": "{count} character left",
  "journal.left.other": "{count} characters left",
  "journal.limit": "No characters left",
  "journal.save": "Save",
  "journal.saved": "Your line is saved.",
  "journal.removed": "Your line was removed.",
  "journal.empty": "There is nothing to save.",
  "journal.age": "At {age}",
  "notes.own": "A line for this year",
  "notes.latest": "Latest lines",
  "notes.none": "Nothing written yet.",
  "notes.all.one": "Read the line in full",
  "notes.all.other": "All {count} lines",
  "notes.dialog.title": "Your journal",
  "notes.dialog.close": "Close",
  "summary.notes.heading": "Your notes",
  "birth.back": "Back",

  // When a screen cannot be shown (for example a saved life that names text this version no longer has).
  "app.error.title": "Something went wrong",
  "app.error.body": "This part of the game could not be shown. Your saved lives have not been changed.",
};
