// Text for what the life systems raise themselves: the decisions about school, care and partners, and
// the quieter moments of friendship, work and the family. Events from the catalog are in events/.
export const systemStrings: Readonly<Record<string, string>> = {
  // Softened tellings of a death in the family (EVENT-006).
  "event.family.mother_died.soft": "{name}, your mother, dies.",
  "event.family.father_died.soft": "{name}, your father, dies.",
  "event.family.relative_died.soft": "{name} dies.",
  "event.family.child_died":
    "{name}, your child, dies. There are no words that fit, and the house keeps listening for them.",
  "event.family.child_died.soft": "{name}, your child, dies.",
  "event.family.partner_died":
    "{name}, who shared your days, dies. You reach for them out of habit, and the habit takes a long time to leave.",
  "event.family.partner_died.soft": "{name}, your partner, dies.",
  "event.family.friend_died": "{name}, a friend you had kept, dies. Something of the years you shared goes with them.",
  "event.family.friend_died.soft": "{name}, your friend, dies.",

  "event.edu.leave_school_for_work.pressure":
    "Money is short, and there is talk at home of what you could earn instead of what you could learn. Nobody wants it to be your decision, and it is.",
  "event.edu.leave_school_for_work.labour":
    "You already work to help the household, and school fits in around the work less and less. The family needs more of your hands than it did, and you have a say, though not much.",
  "choice.edu.leave.leave": "Leave school and work",
  "choice.edu.leave.stay": "Try to stay in school",
  "outcome.edu.leave.leave":
    "You leave school. The hours that were lessons become work, and the money, when it comes, helps.",
  "outcome.edu.leave.stay_ok":
    "You keep your place. It costs the household something, and you feel the weight of that every morning on the way in.",
  "outcome.edu.leave.stay_fail":
    "You try, and the money does not stretch. By the end of the season you are working, and you do not go back.",
  "lens.stay_in_school": "keep your place at school",
  "lens.leave_anyway": "have to leave anyway",
  "lock.cannot_spare": "The household cannot spare you: the work you do is part of what keeps it going.",

  "event.edu.higher_education":
    "You have finished secondary school. Beyond it is higher education, if you want it and can reach it, and the years it would take are years not spent earning.",
  "choice.edu.higher.try": "Enrol in higher education",
  "choice.edu.higher.scholarship": "Try for a scholarship",
  "choice.edu.higher.work": "Go straight to work",
  "outcome.edu.higher.try": "You enrol. Whatever it costs, the household has agreed to find it.",
  "outcome.edu.higher.scholarship_won":
    "The letter comes. Your fees are covered, and the people who helped you with the application are as happy as you.",
  "outcome.edu.higher.scholarship_lost":
    "The letter is polite and short. You put the books away and look for work, and some part of you goes on studying anyway.",
  "outcome.edu.higher.work": "You start looking for work. The books go on a shelf, where you can see them.",
  "lens.finish_degree": "finish the course once you begin",
  "lens.win_scholarship": "win the scholarship",
  "lens.lose_scholarship": "not win it",
  "lock.scholarship_skills": "Scholarships go to those with strong results, and yours are not strong enough yet.",

  "event.work.job_lost": "The work ends. Nobody is angry with you, which somehow makes it harder to bear.",
  "event.work.no_work_yet": "You look for work, and it is not there. Everyone you ask is looking too.",
  "event.work.job_found": "Work turns up at last. The first week you keep expecting it to be taken back.",

  "event.health.seek_care":
    "This is not going to pass by itself. There is care to be had, if you can reach it, and what it would cost is not a small matter.",
  "event.health.usual_care": "You see to it as people around you do, and the cost is what it is.",
  "choice.health.usual": "Seek the usual care",
  "choice.health.best": "Pay for the best care you can find",
  "choice.health.wait": "Wait and see",
  "outcome.health.usual": "You go to the clinic nearest you, and do as you are told.",
  "outcome.health.best":
    "You go to the place people talk about in lowered voices, and stay as long as it takes. The bill comes after.",
  "outcome.health.wait": "You put it off. Other things need doing, and you hope it will ease on its own.",
  "lens.condition_worsens": "it gets worse this year",
  "lens.condition_eases": "it gets better this year",
  "lock.cannot_afford": "That is more than you or your household could find, even by borrowing.",

  "event.rel.meet_partner":
    "Over this past year you have come to know {partner}. Something is growing between you, and it could be allowed to, or not.",
  "choice.rel.pursue": "Let it grow",
  "choice.rel.decline": "Let it pass",
  "outcome.rel.pursue": "You spend more time together, and it stops being an accident that you do.",
  "outcome.rel.decline": "You let it pass, with kindness on both sides. There will be other times, or there will not.",
  "event.rel.marriage":
    "You and {partner} marry. Whoever is there, the day belongs to the two of you, and the years after it are the point.",
  "event.rel.young_marriage":
    "A marriage has been arranged for you, to {partner}, and soon. You are young, and the people who decided did so out of love, or fear, or habit, and often all three.",
  "event.rel.young_marriage_arranged":
    "A marriage has been arranged for you, to {partner}, and it goes ahead. You are young, and you learn the shape of the new household quickly.",
  "event.rel.young_marriage.soft": "A marriage has been arranged for you, to {partner}, and soon. You are young.",
  "event.rel.young_marriage_arranged.soft":
    "A marriage has been arranged for you, to {partner}, and it goes ahead. You are young.",
  "choice.rel.young_accept": "Accept it",
  "choice.rel.young_wait": "Ask to wait",
  "outcome.rel.young_accept": "You marry. The household around you changes shape, and you learn the new one quickly.",
  "outcome.rel.young_wait_works":
    "They listen. The marriage is put off, for now, and you are given time you did not expect to have.",
  "outcome.rel.young_wait_fails": "You ask, and are heard, and it makes no difference. The marriage goes ahead.",
  "lens.wait_works": "be allowed to wait",
  "lens.wait_fails": "have to marry now",

  "event.friends.made":
    "{friend} becomes a friend. It happens the way it always does, without anyone deciding, and then it is simply so.",
  "event.friends.drifted": "You and {friend} drift apart. No quarrel, only fewer evenings, and then none.",
  "event.family.child_born": "{name}, your child, is born. For a long while the world is the size of one small person.",
  "event.family.parent_ill":
    "{name}, your parent, falls ill and needs looking after. The family rearranges itself around the bed.",
  "event.family.partner_ill": "{name}, who shares your days, falls ill, and the days become about caring.",
  "event.family.recovered": "{name} is well again. The house breathes out.",

  "help.illness":
    "If a diagnosis or a long illness is weighing on you, free, confidential helplines exist around the world.",
  "cause.selfHarm": "suicide",
  "lens.line": "{what}: {odds}",
};
