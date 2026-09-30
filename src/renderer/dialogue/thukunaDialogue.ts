export type DialogueCategory =
  | "idle"
  | "clicked"
  | "annoyed"
  | "angry"
  | "dragged"
  | "dropped"
  | "sleeping"
  | "laughing"
  | "rage"
  | "mouse"
  | "sprint"
  | "fall"
  | "freeze"
  | "zoom"
  | "chaos"
  | "domain"
  | "timer";

export const THUKUNA_DIALOGUE: Readonly<
  Record<DialogueCategory, readonly string[]>
> = {
  idle: ["...", "hm."],
  clicked: ["what.", "hm?", "why.", "stop.", "you again.", "interesting."],
  annoyed: ["don't.", "quit that.", "really?", "you're annoying.", "touch me again."],
  angry: ["ENOUGH.", "wrong move.", "keep trying.", "you have chosen poorly."],
  dragged: ["PUT ME DOWN.", "where are we going.", "release me.", "this is humiliating."],
  dropped: ["...", "rude.", "finally.", "never do that again."],
  sleeping: ["zz...", "five more minutes."],
  laughing: ["hehe.", "HAHA.", "funny."],
  rage: ["STOP.", "I SAID STOP.", "YOU DARE?"],
  mouse: ["come here.", "interesting.", "stop moving.", "got you.", "where are you going.", "hm."],
  sprint: ["BYE.", "too slow.", "hehe."],
  fall: ["...", "that was intentional."],
  freeze: ["...", "what.", "I see you."],
  zoom: ["closer.", "hm."],
  chaos: ["HAHA.", "run."],
  domain: ["DOMAIN EXPANSION.", "hehe."],
  timer: ["Timer done!", "Focus session complete!"]
};
