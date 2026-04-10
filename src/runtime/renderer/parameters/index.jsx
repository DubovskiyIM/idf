import TextControl from "./TextControl.jsx";
import TextareaControl from "./TextareaControl.jsx";
import DateTimeControl from "./DateTimeControl.jsx";
import FileControl from "./FileControl.jsx";

const CONTROLS_BY_TYPE = {
  text: TextControl,
  email: TextControl,
  tel: TextControl,
  url: TextControl,
  number: TextControl,
  textarea: TextareaControl,
  datetime: DateTimeControl,
  file: FileControl,
};

export default function ParameterControl({ spec, value, onChange, error }) {
  const Component = CONTROLS_BY_TYPE[spec.control] || TextControl;
  return <Component spec={spec} value={value} onChange={onChange} error={error} />;
}
