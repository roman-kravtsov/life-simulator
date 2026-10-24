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
  "plan.area.bond": "Bond",
  "plan.area.rest": "Rest",
  "plan.what.learn": "Skills and school.",
  "plan.what.earn": "Income and work.",
  "plan.what.health": "Health and care.",
  "plan.what.bond": "Belonging and friends.",
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
  "help.newTab": "Opens in a new tab.",
};
