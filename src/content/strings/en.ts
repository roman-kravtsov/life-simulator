// English strings. Keys are grouped by screen.
export const en: Readonly<Record<string, string>> = {
  "app.title": "Birthright",
  "app.subtitle": "a life simulation",
  "app.skipToContent": "Skip to content",

  "start.intro":
    "You will be born somewhere in the world, to a family you did not choose. Where, and to whom, follows the real odds of birth today. What you make of it is partly up to you.",
  "start.contentNote":
    "This game includes death, illness, poverty, violence and suicide, at the rates they happen in the real world. They are never shown in graphic detail.",
  "start.begin": "Begin a life",
  "start.privacy": "Everything stays in your browser. Nothing is tracked or sent anywhere.",
  "start.sources": "Where the numbers come from",
  "start.preview": "Early preview: the world, family and events arrive in the next milestones.",

  "life.age": "Age {age}",
  "life.stage.infancy": "Infancy",
  "life.stage.childhood": "Childhood",
  "life.stage.adolescence": "Adolescence",
  "life.stage.youth": "Youth",
  "life.stage.adulthood": "Adulthood",
  "life.stage.midlife": "Midlife",
  "life.stage.elder": "Old age",
  "life.stat.health": "Health",
  "life.stat.wellbeing": "Wellbeing",
  "life.stat.bonds": "Bonds",
  "life.stat.skills": "Skills",
  "life.continue": "Continue to the next year",
  "life.stageReached": "A new chapter begins: {stage}.",
  "life.yearPassed": "You turn {age}.",
  "life.backToStart": "Back to start",

  "sources.title": "Where the numbers come from",
  "sources.intro":
    "Birthright draws its odds from public statistics. Each country's figures come from the publishers below, and every value in the game keeps its source and year.",
  "sources.loading": "Loading the sources…",
  "sources.error": "The sources could not be loaded. Check your connection and try again.",
  "sources.retry": "Try again",
  "sources.back": "Back",
  "sources.summary": "Data version {version}. {count} countries are included.",
  "sources.list": "Sources",
  "sources.field.publisher": "Publisher",
  "sources.field.licence": "Licence",
  "sources.field.edition": "Edition",
  "sources.field.accessed": "Downloaded",
  "sources.estimate.title": "Estimated values",
  "sources.estimate.note":
    "Where a country has no figure for a minor indicator, the game uses the average of its region, then of its income group, then of the world. These values are labelled as estimates and are never presented as facts about the country.",
  "sources.terms":
    "Health data from the World Health Organization are used for public health education, under WHO's data terms. Birthright is a free, non-commercial project and is not endorsed by WHO or by any other publisher listed here.",
  "sources.excluded.title": "Countries not in the game",
  "sources.excluded.body":
    "{count} countries and areas are left out because the sources do not have every core figure for them. When you are born, the country is drawn from the included ones by their number of births each year, so the left-out countries' share is spread across the rest.",
  "sources.excluded.show": "Show the {count} countries and what is missing",
  "sources.excluded.item": "{country}: {missing}",
  "sources.missing.demography.lifeTable": "life table",
  "sources.missing.demography.birthsPerYear": "births",
  "sources.missing.demography.population": "population",
  "sources.missing.money.percentiles": "income distribution",
  "sources.missing.money.welfareType": "income distribution",
  "sources.missing.health.causeMix": "causes of death",
  "sources.missing.incomeGroup": "income group",

  "theme.toggle": "Switch light or dark",
};
