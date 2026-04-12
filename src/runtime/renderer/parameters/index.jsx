import TextControl from "./TextControl.jsx";
import TextareaControl from "./TextareaControl.jsx";
import DateTimeControl from "./DateTimeControl.jsx";
import FileControl from "./FileControl.jsx";
import ImageControl from "./ImageControl.jsx";
import MultiImageControl from "./MultiImageControl.jsx";
import { getAdaptedComponent } from "../adapters/registry.js";

// Built-in fallback: используется если адаптер не зарегистрирован или
// конкретного control type в нём нет. В последнем случае падаем на
// TextControl как универсальный fallback.
const CONTROLS_BY_TYPE = {
  text: TextControl,
  email: TextControl,
  tel: TextControl,
  url: TextControl,
  number: TextControl,
  textarea: TextareaControl,
  datetime: DateTimeControl,
  file: FileControl,
  image: ImageControl,
  multiImage: MultiImageControl,
};

export default function ParameterControl({ spec, value, onChange, error }) {
  // Сначала пробуем UI-адаптер (Mantine и т.п.) — §17 адаптивный слой.
  // Адаптер категории parameter возвращает React-компонент для данного
  // control type; если null — используем built-in.
  const Adapted = getAdaptedComponent("parameter", spec.control);
  if (Adapted) {
    return <Adapted spec={spec} value={value} onChange={onChange} error={error} />;
  }
  const Component = CONTROLS_BY_TYPE[spec.control] || TextControl;
  return <Component spec={spec} value={value} onChange={onChange} error={error} />;
}
