/**
 * Регистрация lifequest canvas-компонентов.
 * Используется из prototype.jsx и standalone.jsx — единственный источник правды.
 */
import { registerCanvas } from "@intent-driven/renderer";
import TodayCanvas from "./canvas/TodayCanvas.jsx";
import CalendarCanvas from "./canvas/CalendarCanvas.jsx";
import VisionBoardCanvas from "./canvas/VisionBoardCanvas.jsx";
import PointACanvas from "./canvas/PointACanvas.jsx";
import WeekProgressCanvas from "./canvas/WeekProgressCanvas.jsx";

export function registerLifequestCanvases() {
  registerCanvas("today", (props) => <TodayCanvas {...props} ctx={props.ctx} />);
  registerCanvas("calendar", ({ world, exec, viewer, ctx }) => (
    <CalendarCanvas world={world} viewer={viewer} exec={exec}
      onDayClick={(date) => ctx.navigate?.("today", { userId: viewer?.id, date })} />
  ));
  registerCanvas("vision_board", ({ world, exec, viewer }) => (
    <VisionBoardCanvas world={world} viewer={viewer} exec={exec} />
  ));
  registerCanvas("point_a", PointACanvas);
  registerCanvas("week_progress", WeekProgressCanvas);
}
