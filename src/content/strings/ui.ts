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

  "start.deleted": "All local data in this browser was deleted.",
  "past.deleted": "The life of {name} was deleted.",
  "past.deleteFailed":
    "The life of {name} could not be deleted. This browser's storage may be full, blocked or turned off.",
  "past.deleteAll.failed":
    "Your local data could not be deleted. This browser's storage may be full, blocked or turned off.",

  // When a screen cannot be shown (for example a saved life that names text this version no longer has).
  "app.error.title": "Something went wrong",
  "app.error.body": "This part of the game could not be shown. Your saved lives have not been changed.",
};
