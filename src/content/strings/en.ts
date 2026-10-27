// English strings. Keys are grouped by screen.
import { deathStrings } from "./death";
import { adolescenceStrings } from "./events/adolescence";
import { adulthoodStrings } from "./events/adulthood";
import { earlyStrings } from "./events/early";
import { elderStrings } from "./events/elder";
import { lensStrings } from "./events/lens";
import { midlifeStrings } from "./events/midlife";
import { shockStrings } from "./events/shocks";
import { youthStrings } from "./events/youth";
import { reflectionStrings } from "./reflection";
import { summaryStrings } from "./summary";
import { systemStrings } from "./systems";
import { uiStrings } from "./ui";

export const en: Readonly<Record<string, string>> = {
  ...systemStrings,
  ...uiStrings,
  ...deathStrings,
  ...summaryStrings,
  ...reflectionStrings,
  ...earlyStrings,
  ...adolescenceStrings,
  ...youthStrings,
  ...adulthoodStrings,
  ...midlifeStrings,
  ...elderStrings,
  ...shockStrings,
  ...lensStrings,
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
  "start.settings": "Settings",
  "start.more": "More",
  "start.loading": "Finding where you are born…",
  "start.error": "The world could not be loaded. Check your connection and try again.",

  "birth.title": "You are born in {country}",
  "birth.year": "Born in {year}",
  "birth.you": "You are {name}, a {sex}.",
  "birth.sex.female": "girl",
  "birth.sex.male": "boy",
  "birth.place.rural": "Your family lives in the countryside.",
  "birth.place.urban": "Your family lives in a town or city.",
  "birth.household":
    "Of all the households in {country}, yours is in {band}. Each person in it lives on about {income} a day (international dollars, {year}).",
  "birth.band.1": "the poorest tenth",
  "birth.band.2": "the second-poorest tenth",
  "birth.band.3": "the third-poorest tenth",
  "birth.band.4": "the fourth-poorest tenth",
  "birth.band.5": "the tenth just below the middle",
  "birth.band.6": "the tenth just above the middle",
  "birth.band.7": "the fourth-richest tenth",
  "birth.band.8": "the third-richest tenth",
  "birth.band.9": "the second-richest tenth",
  "birth.band.10": "the richest tenth",
  "birth.parents": "Your mother, {mother}, is {motherAge}. Your father, {father}, is {fatherAge}.",
  "birth.siblings.none": "You have no older brothers or sisters.",
  "birth.siblings.one": "You have one older brother or sister.",
  "birth.siblings.other": "You have {count} older brothers and sisters.",
  "birth.country": "Where you were born",
  "birth.seed": "Life {seed}",
  "birth.continue": "Begin this life",

  // The birth reveal (UI-016): the names that pass are never read out, only these.
  "reveal.title": "Where you are born",
  "reveal.finding": "Finding where you are born…",
  "reveal.result": "You are born in {country}",
  "reveal.skip": "Skip the reveal",
  "reveal.continue": "Continue",
  "reveal.share": "About 1 in {share} of the year's births, across the {count} countries in this game, happen here.",
  "reveal.opening": "Opening your life…",
  "reveal.chanceNote": "Where you are born is drawn by chance, weighted by where children are born each year.",

  "kind.mother": "mother",
  "kind.father": "father",
  "kind.sibling": "sibling",
  "kind.partner": "partner",
  "kind.spouse": "spouse",
  "kind.child": "child",
  "kind.friend": "friend",
  "kind.mentor": "mentor",

  "life.age": "Age {age}",
  "life.stage.infancy": "Infancy",
  "life.stage.childhood": "Childhood",
  "life.stage.adolescence": "Adolescence",
  "life.stage.youth": "Youth",
  "life.stage.adulthood": "Adulthood",
  "life.stage.midlife": "Midlife",
  "life.stage.elder": "Old age",
  "life.stat.health": "Health",
  "life.stat.happiness": "Happiness",
  "life.stat.belonging": "Belonging",
  "life.stat.skills": "Skills",
  "life.continue": "Continue to the next year",
  "life.stageReached": "A new chapter begins: {stage}.",
  "life.yearPassed": "You turn {age}.",
  "life.backToStart": "Back to start",
  "life.where": "{country}, {place}",
  "life.place.rural": "countryside",
  "life.place.urban": "town or city",
  "life.family": "Family",
  "life.relative.alive": "{name}, your {kind}, {age}",
  "life.relative.dead": "{name}, your {kind}, died at {age}",
  "life.thisYear": "This year",
  "life.quietYear": "A quiet year.",
  "life.note": "{note} ({source}, {year})",
  "life.died": "Your life ends at {age}, of {cause}.",
  "life.ended": "Life ended",
  "help.link": "findahelpline.com",
  "help.grief": "If the loss is weighing on you, free, confidential helplines exist around the world.",
  "help.suicide":
    "If thoughts of ending a life are close to you, please reach out. Free, confidential helplines exist around the world, and you do not have to carry this alone.",
  "help.violence": "If this touches something you have lived, free, confidential helplines exist around the world.",
  "help.abuse": "If this is close to your own life, free, confidential helplines exist around the world.",
  "help.addiction": "If drink or drugs feel hard to put down, free, confidential helplines exist around the world.",
  "life.another": "Begin another life",

  "cause.infectious": "an infectious disease",
  "cause.respiratoryInfection": "a respiratory infection",
  "cause.neonatal": "complications around birth",
  "cause.nutritional": "hunger and malnutrition",
  "cause.cancer": "cancer",
  "cause.diabetes": "diabetes",
  "cause.cardiovascular": "heart and circulatory disease",
  "cause.chronicRespiratory": "a chronic lung disease",
  "cause.digestive": "a digestive illness",
  "cause.congenital": "a condition present from birth",
  "cause.unintentionalInjury": "an accident",
  "cause.violence": "violence",
  "cause.conflict": "war",
  "cause.other": "a cause not listed here",

  "note.unemployment": "Here, about {share} of the people who look for work cannot find it",

  "event.family.mother_died": "{name}, your mother, dies. The house is a different size afterwards.",
  "event.family.father_died":
    "{name}, your father, dies. People bring food and speak quietly, and you are not sure where to stand.",
  "event.family.relative_died": "{name} dies. The family gathers, and the gap in it is plain to everyone.",
  "event.check.child_labour_starts":
    "There is work to be done and not enough hands, so yours are needed. School, if there is school, fits in around it.",
  "event.check.child_labour_ends": "The work you did as a child is behind you now.",

  "event.infancy.first_steps":
    "You take your first steps from one pair of hands to the next. Everyone watching laughs.",
  "event.infancy.lullaby": "The same song, every night, until it is the sound of being safe.",
  "event.infancy.fever": "A fever keeps the household awake for three nights. It breaks before dawn on the fourth.",
  "event.childhood.long_walk":
    "The way to water, to school, to anywhere, is long. You learn the road by its stones and by who you meet on it.",
  "event.childhood.teacher_notices":
    "A teacher stops at your work and is quiet for a moment, then says your name as if it were praise.",
  "event.childhood.harvest_help":
    "The harvest needs every pair of hands, and yours are among them. You are tired and proud in about equal parts.",
  "event.adolescence.first_friend":
    "Someone sits beside you without being asked. By the end of the year you cannot remember not knowing them.",
  "event.adolescence.growth_spurt": "You grow out of your clothes and into a body that is yours only by half.",
  "event.youth.restless_year":
    "You are restless. You read what you can find, ask questions nobody has time for, and sleep badly with the window open.",
  "event.adulthood.hard_times": "Money is tight everywhere. People lean on each other more than they say.",
  "event.adulthood.quiet_evening":
    "One evening the work is done early. You sit outside while the light goes, and nothing is asked of you.",
  "event.midlife.old_injury": "An old strain comes back and stays. You learn to plan your days around it.",
  "event.midlife.looking_back":
    "You catch yourself telling a story you have never told. It sounds, for once, like a life.",
  "event.elder.stories": "The young ones come to be told things. You tell them, and some of it is even true.",
  "event.elder.slower_mornings": "Mornings start slower. The body keeps its own calendar now.",

  "event.school.starts": "This is the year you are old enough for school, whether or not there is a place for you.",
  "event.school.left.primary":
    "You leave school before you have finished. Nobody calls it a decision. The days simply fill with other things.",
  "event.school.left.lower-secondary":
    "You leave school in the middle years. Some of the others go on without you, and the gap between you and them begins to show.",
  "event.school.left.upper-secondary":
    "You leave school before the last exams. What you have learned goes with you, and so does the sense of something unfinished.",
  "event.school.left.tertiary":
    "You leave your studies before the end. The reasons are real ones, and they are not the whole story.",
  "event.school.completed.primary": "You finish primary school. Not everyone you started with is still beside you.",
  "event.school.completed.lower-secondary":
    "You finish lower secondary school, and a door you did not know was there stands open.",
  "event.school.completed.upper-secondary":
    "You finish secondary school. For many of the people you grew up with, that was never on offer.",
  "event.school.completed.tertiary": "You complete your studies. The certificate is thin paper for how much it took.",

  "event.work.starts.agriculture.formal": "You begin work on the land, for wages and a name on a list.",
  "event.work.starts.agriculture.informal":
    "You begin work on the land, with no contract but the season and who you know.",
  "event.work.starts.industry.formal":
    "You begin work in a workshop or factory, with fixed hours and a place on the roster.",
  "event.work.starts.industry.informal":
    "You begin work with your hands, in building or making, paid by the day when there is a day to be paid for.",
  "event.work.starts.services.formal":
    "You begin work serving others, in an office, a shop or a school, with a regular pay.",
  "event.work.starts.services.informal":
    "You begin work trading and serving, at a stall or on the road, with no one to answer to and no one to fall back on.",
  "event.work.retires": "You stop working. The days are your own now, which is a gift of an odd shape.",
  "event.work.stops": "You step back from paid work to look after the home and the family. It is work all the same.",

  "event.money.debt_pressure":
    "What you owe has grown beyond what a year can repay. It sits in the room with you at night.",
  "event.money.debt_cleared": "The last of the debt is paid. For a while you keep expecting someone to ask for more.",

  "event.family.sibling_born":
    "{name}, a new brother or sister, joins the household. There is one more mouth, and one more pair of hands to come.",
  "condition.congenital_condition": "a lasting condition",
  "event.condition.congenital_condition.begins":
    "Something is different about your body from the very first days. The family learns what it needs, a step at a time.",
  "event.condition.congenital_condition.worsens": "It asks more of you this year than it did.",
  "event.condition.congenital_condition.eases":
    "It asks a little less of you this year, and the days have more room in them.",
  "event.condition.congenital_condition.ends": "It settles, and for a time it asks less.",
  "condition.undernutrition": "hunger in childhood",
  "event.condition.undernutrition.begins":
    "There is not always enough to eat, and your body holds back its growing to make do.",
  "event.condition.undernutrition.worsens": "The lean months are leaner this year.",
  "event.condition.undernutrition.eases": "There is a little more to eat than there was, and you begin to feel it.",
  "event.condition.undernutrition.ends": "Food is steadier now, and you begin to catch up.",
  "condition.pneumonia": "pneumonia",
  "event.condition.pneumonia.begins":
    "A cough that will not leave turns into a chest that rattles, and breathing becomes the whole of the day.",
  "event.condition.pneumonia.worsens": "The fever returns and the nights are long.",
  "event.condition.pneumonia.eases": "The fever breaks, though the cough lingers and you tire easily.",
  "event.condition.pneumonia.ends": "The cough loosens its hold, and breathing is something you forget about again.",
  "condition.malaria": "malaria",
  "event.condition.malaria.begins":
    "The fever comes in waves, shaking you hot and cold, and the days fall out of order.",
  "event.condition.malaria.worsens": "This bout is worse than the last, and it takes longer to rise from it.",
  "event.condition.malaria.eases": "The fevers come less often, though you are not yet free of them.",
  "event.condition.malaria.ends": "The fevers come less often, and then stop.",
  "condition.tuberculosis": "tuberculosis",
  "event.condition.tuberculosis.begins":
    "A cough lingers for weeks, then months. People begin to keep a careful distance, and you feel it.",
  "event.condition.tuberculosis.worsens":
    "The illness takes more of you this year, and the cough comes with an ache you cannot place.",
  "event.condition.tuberculosis.eases": "The medicine is working. The cough is quieter, though the course is not over.",
  "event.condition.tuberculosis.ends": "With the long course of medicine behind you, the cough is gone.",
  "condition.serious_injury": "a serious injury",
  "event.condition.serious_injury.begins":
    "One moment of carelessness, or none at all, and you are hurt badly enough to be carried home.",
  "event.condition.serious_injury.worsens": "The injury has not healed as it should, and it limits what you can do.",
  "event.condition.serious_injury.eases": "The injury gives a little. Some movements come back, though not all.",
  "event.condition.serious_injury.ends": "The injury heals, slowly, and mostly well.",
  "condition.depression": "depression",
  "event.condition.depression.begins":
    "A heaviness settles over you that has no clear cause. Colours dull, and the things you used to look forward to are only things.",
  "event.condition.depression.begins.soft":
    "A heaviness settles over you, and the things you used to look forward to feel far away.",
  "event.condition.depression.worsens": "The heaviness is deeper this year, and harder to explain to anyone.",
  "event.condition.depression.worsens.soft": "The heaviness is deeper this year.",
  "event.condition.depression.eases": "Some days the heaviness thins, and you notice the light in a room again.",
  "event.condition.depression.ends": "The heaviness lifts a little, as weather does. There is room in the days again.",
  "condition.chronic_back_pain": "back pain",
  "event.condition.chronic_back_pain.begins":
    "Years of lifting and bending have left a pain in your back that is there when you wake.",
  "event.condition.chronic_back_pain.worsens": "The pain is sharper now, and it sets the pace of your days.",
  "event.condition.chronic_back_pain.eases":
    "The pain is duller this year, and you plan your days around it a little less.",
  "event.condition.chronic_back_pain.ends": "The pain eases, and some mornings you forget it.",
  "condition.hypertension": "high blood pressure",
  "event.condition.hypertension.begins":
    "A health worker tells you your blood pressure is high, which explains the headaches and nothing about what to do next.",
  "event.condition.hypertension.worsens": "Your blood pressure climbs, and the advice gets more serious.",
  "event.condition.hypertension.eases":
    "Your blood pressure is lower than at the last visit, though the advice stays the same.",
  "event.condition.hypertension.ends": "Your blood pressure comes down a little, and the headaches fade.",
  "condition.diabetes": "diabetes",
  "event.condition.diabetes.begins":
    "You are told your body can no longer manage sugar on its own, and that food and time have become things you will have to count.",
  "event.condition.diabetes.worsens": "Keeping your blood sugar in check takes more effort this year.",
  "event.condition.diabetes.eases": "Your sugar is steadier than it was, and the routine feels less like a siege.",
  "event.condition.diabetes.ends": "Your sugar is steadier, and the days are easier to plan.",
  "condition.heart_disease": "heart disease",
  "event.condition.heart_disease.begins":
    "Climbing a flight of steps leaves you breathless and with a tightness in the chest. A doctor, if you can reach one, uses a word you are afraid of.",
  "event.condition.heart_disease.worsens":
    "Your heart gives you less to work with than it did, and rest has to be planned.",
  "event.condition.heart_disease.eases": "Your heart seems steadier, and the stairs are a little less of an argument.",
  "event.condition.heart_disease.ends": "Your heart is steadier this year, and you walk a little further.",
  "condition.chronic_lung_disease": "a chronic lung disease",
  "event.condition.chronic_lung_disease.begins":
    "Smoke, dust and years have left your lungs tired. You cough in the mornings and stop for breath on the stairs.",
  "event.condition.chronic_lung_disease.worsens": "Your breathing is shorter this year, and the cough stays.",
  "event.condition.chronic_lung_disease.eases":
    "Your breathing is easier for a stretch, though the cough has not gone.",
  "event.condition.chronic_lung_disease.ends": "Your breathing is easier for a while.",
  "condition.liver_disease": "liver disease",
  "event.condition.liver_disease.begins":
    "You are tired in a way sleep does not touch, and a doctor tells you your liver is struggling.",
  "event.condition.liver_disease.worsens":
    "Your liver is struggling more this year, and you feel it in your whole body.",
  "event.condition.liver_disease.eases":
    "The tests are a little better, and you are told to keep doing what you are doing.",
  "event.condition.liver_disease.ends": "Your liver has some rest, and you are a little less tired.",
  "condition.cancer": "cancer",
  "event.condition.cancer.begins":
    "A lump, a test, a long wait, and then a word that changes the shape of the years ahead.",
  "event.condition.cancer.begins.soft": "You are told you have cancer, and the years ahead change shape.",
  "event.condition.cancer.worsens": "The illness has moved, and the talk around you is lower and more careful.",
  "event.condition.cancer.worsens.soft": "The illness has moved, and the talk around you is more careful.",
  "event.condition.cancer.eases": "The news is better than it was: smaller, slower, a reason for cautious hope.",
  "event.condition.cancer.ends":
    "The tests come back better than anyone expected. You are told to be glad, and you are, carefully.",

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

  "common.years.one": "{count} year",
  "common.years.other": "{count} years",

  "kind.sibling.female": "sister",
  "kind.sibling.male": "brother",

  "school.heading": "School",
  "school.field.level": "Schooling",
  "school.field.years": "Time in school",
  "school.field.reading": "Reading",
  "school.status.too-young": "Too young for school yet.",
  "school.status.never": "You did not go to school.",
  "school.status.left-early": "You left school before finishing primary school.",
  "school.status.attending.primary": "In primary school.",
  "school.status.attending.lower-secondary": "In lower secondary school.",
  "school.status.attending.upper-secondary": "In upper secondary school.",
  "school.status.attending.tertiary": "In higher education.",
  "school.status.completed.primary": "Finished primary school.",
  "school.status.completed.lower-secondary": "Finished lower secondary school.",
  "school.status.completed.upper-secondary": "Finished upper secondary school.",
  "school.status.completed.tertiary": "Finished higher education.",
  "school.reading.literate": "You can read and write.",
  "school.reading.illiterate": "You never learned to read well.",

  "work.heading": "Work",
  "work.field.status": "Now",
  "work.field.years": "Time in work",
  "work.status.too-young": "Too young for paid work.",
  "work.status.at-home": "At home. You are not in school, and not yet in paid work.",
  "work.status.student": "Studying. School is your work for now.",
  "work.status.unemployed": "Looking for work and not finding it.",
  "work.status.caregiver": "Looking after the home and the family.",
  "work.status.retired": "Retired.",
  "work.status.working": "Working in {sector}: {terms}.",
  "work.status.working.nosector": "Working: {terms}.",
  "work.sector.agriculture": "agriculture",
  "work.sector.industry": "industry",
  "work.sector.services": "services",
  "work.terms.formal": "steady, formal work",
  "work.terms.informal": "informal work with no contract",

  "money.heading": "Money",
  "money.field.daily.household": "Each person in your household, a day",
  "money.field.daily.own": "Your income, a day",
  "money.field.yearly.household": "Each person in your household, a year",
  "money.field.yearly.own": "Your income, a year",
  "money.field.band": "What that means",
  "money.field.savings": "Savings",
  "money.field.debt": "Debt",
  "money.field.holdings": "Savings and debt",
  "money.none": "No savings and no debts.",
  "money.note": "Amounts are in international dollars, which adjust for what money buys in each country ({year}).",
  "money.band.below-extreme": "below the international line for extreme poverty",
  "money.band.near-extreme": "just above the international line for extreme poverty",
  "money.band.low": "very little to spare, and a bad year could undo it",
  "money.band.modest": "enough to live on if nothing goes wrong",
  "money.band.comfortable": "comfortable, with room for some savings and some surprises",
  "money.band.wealthy": "wealthy, by the standards of most of the world",
  "money.usSwitch": "Compare with US prices",
  "money.usComparison": "In international dollars, an amount here buys what the same amount buys in the United States.",

  "conditions.heading": "Health conditions",
  "conditions.line": "{name}, {severity}, since age {since}",
  "conditions.lineFromBirth": "{name}, {severity}, from birth",
  "severity.1": "mild",
  "severity.2": "moderate",
  "severity.3": "severe",

  "family.parents": "Parents",
  "family.siblings.none": "You have no brothers or sisters",
  "family.siblings.noneLiving": "You have no living brothers or sisters",
  "family.siblings.one": "You have {count} brother or sister",
  "family.siblings.other": "You have {count} brothers and sisters",
  "family.others": "Others in your life",
  "closeness.very-close": "very close",
  "closeness.close": "close",
  "closeness.friendly": "friendly",
  "closeness.distant": "distant",
  "closeness.strained": "strained",
};
