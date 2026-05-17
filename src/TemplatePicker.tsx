import type { AlgorithmTemplate } from "./templates";

type TemplatePickerProps = {
  readonly selectedTemplateId: string;
  readonly templates: readonly AlgorithmTemplate[];
  readonly onSelectTemplate: (template: AlgorithmTemplate) => void;
};

export function TemplatePicker({
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
          onClick={() => onSelectTemplate(template)}
        >
          {template.name}
        </button>
      ))}
    </div>
  );
}
