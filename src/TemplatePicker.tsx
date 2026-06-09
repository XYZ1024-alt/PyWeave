import type { AlgorithmTemplate } from "./templates";
import type { Locale } from "./types";

type TemplatePickerProps = {
  readonly locale: Locale;
  readonly selectedTemplateId: string;
  readonly templates: readonly AlgorithmTemplate[];
  readonly onSelectTemplate: (template: AlgorithmTemplate) => void;
};

export function TemplatePicker({
  locale,
  selectedTemplateId,
  templates,
  onSelectTemplate,
}: TemplatePickerProps) {
  return (
    <div className="template-picker" aria-label="Algorithm templates">
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          className={template.id === selectedTemplateId ? "is-selected" : undefined}
          title={template.description[locale]}
          onClick={() => onSelectTemplate(template)}
        >
          {template.name[locale]}
        </button>
      ))}
    </div>
  );
}
