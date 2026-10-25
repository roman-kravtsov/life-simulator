// Text for the end of a life (SUM-001 to SUM-004, DEATH-003, DEATH-004): the words for what shaped it, for each
// ring theme, for the summary screen and for the epitaph.
export const summaryStrings: Readonly<Record<string, string>> = {
  "summary.shaped.health.circumstance":
    "Most of your health came from where and when you were born: the food, the care within reach, the years you were handed.",
  "summary.shaped.health.choice":
    "Most of your health came from your own choices: what you gave your attention to, and what you did about it.",
  "summary.shaped.health.chance":
    "Most of your health came down to chance: the illnesses that came, and the ones that did not.",
  "summary.shaped.health.mixed":
    "Your health was shaped by birth, by choice and by chance together, with no one of them in front.",
  "summary.shaped.happiness.circumstance":
    "Most of your happiness was shaped by the circumstances you lived in: what was around you, and what you were spared.",
  "summary.shaped.happiness.choice":
    "Most of your happiness came from your choices, from where you put your attention and who you gave it to.",
  "summary.shaped.happiness.chance":
    "Most of your happiness rose and fell with chance: the news that came, and the days that simply went well or badly.",
  "summary.shaped.happiness.mixed":
    "Your happiness was shaped by birth, by choice and by chance together, with no one of them in front.",
  "summary.shaped.belonging.circumstance":
    "Most of your belonging came from circumstance: the family you were born into, and the place you lived.",
  "summary.shaped.belonging.choice":
    "Most of your belonging came from your choices: the people you turned toward, and the time you gave them.",
  "summary.shaped.belonging.chance":
    "Most of your belonging came from chance: who happened to be there, and who was lost.",
  "summary.shaped.belonging.mixed":
    "Your belonging was shaped by birth, by choice and by chance together, with no one of them in front.",
  "summary.shaped.skills.circumstance":
    "Most of what you learned came from circumstance: the schools within reach, and what the years around you taught.",
  "summary.shaped.skills.choice":
    "Most of what you learned came from your choices: the time you gave to learning and to work.",
  "summary.shaped.skills.chance":
    "Most of what you learned came from chance: the teacher you happened to have, and the opening that happened to come.",
  "summary.shaped.skills.mixed":
    "What you learned was shaped by birth, by choice and by chance together, with no one of them in front.",
  "summary.shaped.overall":
    "Across your health, happiness, belonging and skills together, about {circumstance} came from circumstance, {choice} from choice and {chance} from chance.",

  "ring.theme.study": "School and study",
  "ring.theme.work": "Work",
  "ring.theme.love": "Love and family",
  "ring.theme.loss": "Loss",
  "ring.theme.illness": "Illness",
  "ring.theme.move": "A move",
  "ring.theme.plain": "An ordinary year",

  "ring.felt.hard": "A hard year",
  "ring.felt.heavy": "A heavy year",
  "ring.felt.gentle": "A gentle year",
  "ring.felt.happy": "A happy year",

  "summary.subtitle": "{country}, {born} to {died}",
  "summary.died": "Died at {age}, of {cause}.",

  "summary.expectancy.heading": "How long you lived",
  "summary.someone.female": "a woman",
  "summary.someone.male": "a man",
  "summary.people.female": "women",
  "summary.people.male": "men",
  "summary.years.underOne": "less than a year",
  "summary.expectancy.intro": "In {country}, {someone} can expect to live about {expected} ({source}, {year}).",
  "summary.lived.shorter": "You lived {years}, {difference} fewer.",
  "summary.lived.similar": "You lived {years}, about as long.",
  "summary.lived.longer": "You lived {years}, {difference} more.",
  "summary.reached": "About {count} in 100 {people} there live to {age}.",
  "summary.reached.few": "Fewer than 1 in 100 {people} there live to {age}.",

  "summary.rings.heading": "Your life in rings",
  "summary.rings.label.one": "The ring of {name}'s life: one year, at age {last}.",
  "summary.rings.label.other":
    "The rings of {name}'s life: {count} rings, one for each year, from age {first} to age {last}.",
  "summary.rings.caption":
    "Each ring is one year, the first at the centre. Thicker rings were happier years. The colour and the pattern say what the year was mostly about, and the numbers mark the key moments below. The table under the picture gives the same, year by year.",
  "summary.rings.legend": "What each colour and pattern means",
  "summary.rings.table": "Year by year",
  "summary.rings.table.caption": "How each year of the life is drawn",
  "summary.rings.col.age": "Age",
  "summary.rings.col.theme": "What the year was about",
  "summary.rings.col.felt": "How the year felt",
  "summary.rings.col.moment": "Key moment",
  "summary.rings.moment": "Moment {number}",

  "summary.moments.heading": "Key moments",
  "summary.moments.intro": "The years that mattered most, in order. The numbers match the marks on the rings.",
  "summary.moment": "At {age}: {text}",

  "summary.shaped.heading": "What shaped your life",
  "summary.shaped.how": "How this is worked out",
  "summary.shaped.how.one":
    "Everything that moved your health, happiness, belonging and skills carries a tag in the game: circumstance (where, when and into what you were born), choice (what you decided and where you put your attention) or chance (what happened to you, and the luck of each year).",
  "summary.shaped.how.two":
    "The game follows each of these through the years and compares how much each one moved a stat, up or down. These are shares of what moved you, in the game's own model. They are not credit or blame.",

  "summary.facts.heading": "Your life in brief",
  "summary.facts.education.none": "You did not complete a level of school.",
  "summary.facts.education.primary": "You finished primary school.",
  "summary.facts.education.lower-secondary": "You finished lower secondary school.",
  "summary.facts.education.upper-secondary": "You finished upper secondary school.",
  "summary.facts.education.tertiary": "You finished higher education.",
  "summary.facts.literate.yes": "You could read and write.",
  "summary.facts.literate.no": "You never learned to read well.",
  "summary.facts.work.none": "You were never in paid work.",
  "summary.facts.work": "You spent {years} in paid work.",
  "summary.facts.work.sector": "You spent {years} in paid work, last in {sector}.",
  "summary.facts.children.none": "You had no children.",
  "summary.facts.children.one": "You had {count} child.",
  "summary.facts.children.other": "You had {count} children.",
  "summary.facts.siblings.none": "You had no brothers or sisters.",
  "summary.facts.siblings.one": "You had {count} brother or sister.",
  "summary.facts.siblings.other": "You had {count} brothers and sisters.",
  "summary.facts.partner.yes": "You had a partner or spouse in your life.",
  "summary.facts.partner.no": "You did not have a partner or spouse.",
  "summary.facts.conditions": "You lived with {list}.",
  "summary.facts.moves.one": "You moved between the countryside and a town or city once.",
  "summary.facts.moves.other": "You moved between the countryside and a town or city {count} times.",

  "summary.lastYear.heading": "Your last year",

  "summary.epitaph.heading": "A few words",
  "summary.epitaph.intro":
    "If you like, leave a few words for {name}. They are kept with this life, in this browser only.",
  "summary.epitaph.label": "A few words for {name}",
  "summary.epitaph.left.one": "{count} character left",
  "summary.epitaph.left.other": "{count} characters left",
  "summary.epitaph.save": "Save",
  "summary.epitaph.edit": "Edit",
  "summary.epitaph.cancel": "Cancel",
  "summary.epitaph.saved": "Your words for {name} are saved.",
  "summary.epitaph.empty": "Write a few words first.",
  "summary.epitaph.limit": "No characters left",
  "summary.epitaph.removed": "The words for {name} were removed.",

  "summary.seed": "The seed of this life is {seed}. It is what the game used to draw this birth.",
  "summary.past": "Past lives",
  "summary.problem":
    "This life could not be kept in your past lives: this browser's storage would not take it. It may be full, blocked or turned off.",
};
