import { TRACK_LABEL, type Track } from "./missions";
import { longDay, meetsLabel, weekDate } from "./schedule";

// Text the school sends to parents: a short club description for its activities
// sign-up list. Plain text so it pastes anywhere (email, parent app, club list).

export function parentClubDescription(params: {
  clubName: string;
  schoolName: string;
  track: Track;
  termTitle: string;
  termWeeks: number;
  managerName: string | null;
  meetsDay: string | null;
  meetsTime: string | null;
  startsOn: string | null;
}): string {
  const meets = meetsLabel(params.meetsDay, params.meetsTime);
  const first = weekDate(params.startsOn, params.meetsDay, 1);
  const showcase = weekDate(params.startsOn, params.meetsDay, params.termWeeks);
  const lines = [
    `${params.clubName}: the AI Creators Club at ${params.schoolName} (${TRACK_LABEL[params.track].toLowerCase()})`,
    "",
    `This term, “${params.termTitle}”: your child invents their own comic hero and publishes a printed comic, with AI as their illustrator and editor. Along the way they learn how AI works, how to give it precise instructions, how to spot its mistakes, and why their own ideas matter most.`,
    "",
    `One hour a week for ${params.termWeeks} weeks${meets ? `, ${meets.replace(" · ", " at ")}` : ""}${params.managerName ? `, led by ${params.managerName}` : ""}. Children work on paper and on a safe AI platform made for ages 8 to 11: no account, no email, nothing shared outside the club.`,
  ];
  if (first) lines.push("", `First session: ${longDay(first)}.`);
  if (showcase) lines.push(`Comic Con, where children present their comics to parents: ${longDay(showcase)}.`);
  return lines.join("\n");
}
