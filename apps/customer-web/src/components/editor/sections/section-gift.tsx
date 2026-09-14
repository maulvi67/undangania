import { Button, Checkbox, Input, Textarea } from "@wedding/ui";
import type {
  EditorContent,
  EditorGiftItem,
} from "../../../lib/editor/contract";
import type { EditorPatch } from "../editor-form";

function giftId(): string {
  return `gift-${Date.now().toString(36)}`;
}

function updateGift(
  items: EditorContent["gifts"],
  id: string,
  patch: Partial<EditorGiftItem>,
): EditorContent["gifts"] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function SectionGift({
  content,
  onChange,
}: {
  content: EditorContent;
  onChange: (patch: EditorPatch) => void;
}) {
  const addGift = () =>
    onChange({
      gifts: [
        ...content.gifts,
        {
          id: giftId(),
          provider: "",
          accountName: "",
          accountValue: "",
          note: "",
          visible: false,
        },
      ],
    });
  return (
    <div className="ed-section-content">
      <p className="ed-form-note">
        Informasi rekening atau dompet digital adalah data sensitif. Simpan
        hanya informasi yang memang ingin Anda bagikan kepada tamu.
      </p>
      <div className="ed-repeatable-list">
        {content.gifts.map((gift, index) => (
          <fieldset className="ed-repeatable-card" key={gift.id}>
            <legend className="ed-repeatable-card__legend">
              Informasi hadiah {index + 1}
            </legend>
            <Input
              id={`editor-gift-provider-${gift.id}`}
              label="Penyedia"
              hint="Contoh: Bank atau dompet digital"
              value={gift.provider}
              onChange={(event) =>
                onChange({
                  gifts: updateGift(content.gifts, gift.id, {
                    provider: event.currentTarget.value,
                  }),
                })
              }
            />
            <div className="ed-form-grid ed-form-grid--two">
              <Input
                id={`editor-gift-name-${gift.id}`}
                label="Nama pemilik"
                autoComplete="off"
                value={gift.accountName}
                onChange={(event) =>
                  onChange({
                    gifts: updateGift(content.gifts, gift.id, {
                      accountName: event.currentTarget.value,
                    }),
                  })
                }
              />
              <Input
                id={`editor-gift-value-${gift.id}`}
                label="Nomor rekening / akun"
                inputMode="text"
                autoComplete="off"
                value={gift.accountValue}
                onChange={(event) =>
                  onChange({
                    gifts: updateGift(content.gifts, gift.id, {
                      accountValue: event.currentTarget.value,
                    }),
                  })
                }
              />
            </div>
            <Textarea
              id={`editor-gift-note-${gift.id}`}
              label="Catatan"
              value={gift.note}
              onChange={(event) =>
                onChange({
                  gifts: updateGift(content.gifts, gift.id, {
                    note: event.currentTarget.value,
                  }),
                })
              }
            />
            <Checkbox
              id={`editor-gift-visible-${gift.id}`}
              label="Tampilkan informasi ini"
              checked={gift.visible}
              onChange={(event) =>
                onChange({
                  gifts: updateGift(content.gifts, gift.id, {
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
                  gifts: content.gifts.filter((item) => item.id !== gift.id),
                })
              }
            >
              Hapus informasi
            </Button>
          </fieldset>
        ))}
      </div>
      <Button type="button" variant="secondary" onClick={addGift}>
        Tambah informasi hadiah
      </Button>
    </div>
  );
}
