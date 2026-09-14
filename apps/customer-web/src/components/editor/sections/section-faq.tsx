import { Button, Checkbox, Input, Textarea } from "@wedding/ui";
import type {
  EditorContent,
  EditorFaqItem,
} from "../../../lib/editor/contract";
import type { EditorPatch } from "../editor-form";

function faqId(): string {
  return `faq-${Date.now().toString(36)}`;
}

function updateFaq(
  items: EditorContent["faqs"],
  id: string,
  patch: Partial<EditorFaqItem>,
): EditorContent["faqs"] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function SectionFaq({
  content,
  onChange,
}: {
  content: EditorContent;
  onChange: (patch: EditorPatch) => void;
}) {
  const addFaq = () =>
    onChange({
      faqs: [
        ...content.faqs,
        { id: faqId(), question: "", answer: "", visible: false },
      ],
    });
  return (
    <div className="ed-section-content">
      <p className="ed-form-note">
        FAQ opsional. Gunakan untuk menjawab hal-hal praktis seperti dress code,
        parkir, atau batas waktu RSVP.
      </p>
      <div className="ed-repeatable-list">
        {content.faqs.map((faq, index) => (
          <fieldset className="ed-repeatable-card" key={faq.id}>
            <legend className="ed-repeatable-card__legend">
              Pertanyaan {index + 1}
            </legend>
            <Input
              id={`editor-faq-question-${faq.id}`}
              label="Pertanyaan"
              value={faq.question}
              onChange={(event) =>
                onChange({
                  faqs: updateFaq(content.faqs, faq.id, {
                    question: event.currentTarget.value,
                  }),
                })
              }
            />
            <Textarea
              id={`editor-faq-answer-${faq.id}`}
              label="Jawaban"
              value={faq.answer}
              onChange={(event) =>
                onChange({
                  faqs: updateFaq(content.faqs, faq.id, {
                    answer: event.currentTarget.value,
                  }),
                })
              }
            />
            <Checkbox
              id={`editor-faq-visible-${faq.id}`}
              label="Tampilkan pertanyaan ini"
              checked={faq.visible}
              onChange={(event) =>
                onChange({
                  faqs: updateFaq(content.faqs, faq.id, {
                    visible: event.currentTarget.checked,
                  }),
                })
              }
            />
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() =>
                onChange({
                  faqs: content.faqs.filter((item) => item.id !== faq.id),
                })
              }
            >
              Hapus pertanyaan
            </Button>
          </fieldset>
        ))}
      </div>
      <Button type="button" variant="secondary" onClick={addFaq}>
        Tambah pertanyaan
      </Button>
    </div>
  );
}
