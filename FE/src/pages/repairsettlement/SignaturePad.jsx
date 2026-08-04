import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import SignatureCanvas from 'react-signature-canvas';

// Chu ky dien tu tai cho - CVDV dua thiet bi cho nguoi lien he ky truc tiep.
// Canvas that (SignatureCanvas) luon duoc mount 1 lan duy nhat trong portal,
// chi an/hien bang display CSS khi dong/mo modal phong to - KHONG conditional-
// render (KHONG {zoomed && <SignatureCanvas/>}) vi lam vay se huy roi tao lai
// canvas moi lan mo, phai fromDataURL() nap lai anh cu -> chu ky bi ve lai tren
// 1 "khong gian ky" moi nen trong nhu bi thu nho/lech. Giu nguyen 1 canvas
// xuyen suot thi khong gian ky co dinh, khong bao gio doi kich thuoc.
// Dung getCanvas() (khong dung getTrimmedCanvas()) vi ban trim-canvas ma
// react-signature-canvas phu thuoc bi loi interop ESM voi Vite
// ("import_trim_canvas.default is not a function").
function computeCanvasSize() {
  const width = Math.max(360, Math.min(900, window.innerWidth - 96));
  const height = Math.round(width * 0.48);
  return { width, height };
}

const SignaturePad = forwardRef(function SignaturePad({ onChange }, ref) {
  const sigRef = useRef(null);
  const [zoomed, setZoomed] = useState(false);
  const [preview, setPreview] = useState(null);
  const [canvasSize] = useState(computeCanvasSize);

  useImperativeHandle(ref, () => ({
    isEmpty: () => sigRef.current?.isEmpty() ?? true,
    toDataURL: () => (sigRef.current && !sigRef.current.isEmpty() ? sigRef.current.getCanvas().toDataURL('image/png') : null),
    clear: () => {
      sigRef.current?.clear();
      setPreview(null);
      onChange?.(true);
    },
  }));

  const syncFromCanvas = () => {
    const empty = sigRef.current?.isEmpty() ?? true;
    setPreview(empty ? null : sigRef.current.getCanvas().toDataURL('image/png'));
    onChange?.(empty);
  };

  return (
    <>
      <div
        onClick={() => setZoomed(true)}
        style={{
          border: '1px dashed var(--gray-300)', borderRadius: 8, background: '#fff',
          height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', overflow: 'hidden',
        }}
      >
        {preview ? (
          <img src={preview} alt="Chữ ký" style={{ maxWidth: '100%', maxHeight: '100%' }} />
        ) : (
          <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>Nhấn để ký tên</span>
        )}
      </div>

      {createPortal(
        <div
          onClick={() => setZoomed(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000,
            display: zoomed ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 16, maxWidth: 'calc(100vw - 32px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Ký xác nhận</span>
              <button type="button" className="modal-close" onClick={() => setZoomed(false)}>✕</button>
            </div>
            <div style={{ border: '1px dashed var(--gray-300)', borderRadius: 8, touchAction: 'none', width: 'fit-content' }}>
              <SignatureCanvas
                ref={sigRef}
                penColor="#111827"
                backgroundColor="#ffffff"
                canvasProps={{ width: canvasSize.width, height: canvasSize.height }}
                onEnd={syncFromCanvas}
              />
            </div>
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}
              onClick={() => { sigRef.current?.clear(); syncFromCanvas(); }}>
              Xoá
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

export default SignaturePad;
