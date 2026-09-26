import { notFound } from 'next/navigation';
import { CATEGORIES, getProjectRow, listImages, STAMPS } from '@/lib/admin/db';
import { getTeam } from '@/lib/team';
import { captureCoverAction, deleteImageAction, deleteProjectAction, publishProjectAction, saveProjectAction, setCoverAction } from '../../actions';
import { ActionButton, ActionForm, Submit } from '../../ui';
import { ImageManager } from './image-manager';

const parse = <T,>(s: string): T[] => { try { return JSON.parse(s); } catch { return []; } };

export default async function EditProject({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getProjectRow(id);
  if (!p) notFound();
  const images = await listImages(id);
  const members = await getTeam();
  const team = parse<{ slug: string; role: string }>(p.team);
  const results = parse<{ value: string; label: string; source: string }>(p.results);

  return (
    <>
      <p><a className="text-link" href="/admin/projects">All projects</a></p>
      <h1 className="type-h2">{p.title}</h1>
      <div className="admin-actions admin-lead">
        <span className={`pill${p.is_published ? ' is-on' : ''}`}>{p.is_published ? 'Published' : 'Draft'}</span>
        <form action={publishProjectAction.bind(null, id, !p.is_published)}>
          <button className="btn btn-primary btn-sm">{p.is_published ? 'Unpublish' : 'Publish'}</button>
        </form>
        <a className="btn btn-ghost btn-sm" href={`/admin/preview/${p.slug}`} target="_blank" rel="noopener">Preview</a>
      </div>

      <section className="admin-section" aria-labelledby="img-h">
        <h2 id="img-h" className="type-h3">Images</h2>
        <ImageManager projectId={id} />
        <div className="admin-actions" style={{ margin: '16px 0' }}>
          <ActionButton action={captureCoverAction.bind(null, id)}>Capture cover from the live site</ActionButton>
          <span className="muted">Laptop and phone screenshots of {p.live_url ?? 'the live URL (add it below first)'}.</span>
        </div>
        {images.length > 0 && (
          <ul className="thumbs" aria-label="Uploaded images">
            {images.map((im) => (
              <li key={im.id} className="thumb">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                <img src={`/media/${im.r2_key}`} alt={im.alt} width={im.width ?? undefined} height={im.height ?? undefined} style={{ backgroundColor: im.dominant_color ?? undefined }} />
                <p><span className={`pill${im.kind === 'cover' ? ' is-on' : ''}`}>{im.kind}</span> {im.width}×{im.height}{' '}
                  {im.dominant_color && <><span className="swatch" style={{ background: im.dominant_color }} />{im.dominant_color}</>}</p>
                <p>{im.alt}</p>
                <div className="admin-actions">
                  {im.kind !== 'cover' && <form action={setCoverAction.bind(null, id, im.id)}><button className="btn btn-ghost btn-sm">Make cover</button></form>}
                  <form action={deleteImageAction.bind(null, id, im.id)}><button className="btn btn-ghost btn-sm btn-danger">Delete</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="admin-section" aria-labelledby="details-h">
        <h2 id="details-h" className="type-h3">Details</h2>
        <ActionForm action={saveProjectAction.bind(null, id)} className="admin-form">
          <div className="admin-grid">
            <label className="field"><span>Title</span><input name="title" defaultValue={p.title} required maxLength={120} /></label>
            <label className="field"><span>Slug</span><input name="slug" defaultValue={p.slug} required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label>
            <label className="field"><span>Client <small>(e.g. Bakery in Kochi)</small></span><input name="client_type" defaultValue={p.client_type} required maxLength={120} /></label>
            <label className="field"><span>Category <small>(the /work filter)</small></span>
              <select name="category" defaultValue={p.category}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            <label className="field"><span>Result number</span><input name="result_value" defaultValue={p.result_value ?? ''} maxLength={40} placeholder="+38%" /></label>
            <label className="field"><span>Result label</span><input name="result_label" defaultValue={p.result_label ?? ''} maxLength={120} placeholder="more enquiries in 60 days" /></label>
            <label className="field"><span>Before <small>(the proof on the card, e.g. 6.1 s load)</small></span><input name="proof_before" defaultValue={p.proof_before ?? ''} maxLength={40} /></label>
            <label className="field"><span>After <small>(e.g. 0.9 s load; both or neither)</small></span><input name="proof_after" defaultValue={p.proof_after ?? ''} maxLength={40} /></label>
            <label className="field"><span>Tags <small>(comma separated, on the card)</small></span><input name="tags" defaultValue={parse<string>(p.tags).join(', ')} placeholder="Website, WhatsApp" /></label>
            <label className="field"><span>Stack <small>(comma separated)</small></span><input name="stack" defaultValue={parse<string>(p.stack).join(', ')} placeholder="Next.js, Cloudflare" /></label>
            <label className="field"><span>Live URL</span><input name="live_url" type="url" defaultValue={p.live_url ?? ''} placeholder="https://" /></label>
            <label className="field"><span>Status stamp <small>(n8n updates it daily)</small></span>
              <select name="status_stamp" defaultValue={p.status_stamp}>{STAMPS.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
            <label className="field"><span>Launched on</span><input name="launched_on" type="date" defaultValue={p.launched_on ?? ''} /></label>
            <label className="check"><input type="checkbox" name="is_featured" defaultChecked={!!p.is_featured} /> Featured</label>
          </div>
          <label className="field"><span>One-line summary</span><input name="summary" defaultValue={p.summary} required maxLength={300} /></label>
          <label className="field"><span>The challenge <small>(in the client’s words)</small></span><textarea name="challenge" defaultValue={p.challenge ?? ''} /></label>
          <label className="field"><span>What we built <small>(one per line)</small></span><textarea name="built" defaultValue={parse<string>(p.built).join('\n')} /></label>
          <label className="field"><span>Results <small>(one per line: number | label | source)</small></span>
            <textarea name="results" defaultValue={results.map((r) => `${r.value} | ${r.label} | ${r.source}`).join('\n')} placeholder="+38% | more enquiries in 60 days | contact form records, Jan–Mar" /></label>
          <fieldset className="admin-fieldset">
            <legend>Who built it</legend>
            {members.map((m) => {
              const t = team.find((x) => x.slug === m.slug);
              return (
                <div key={m.slug} className="team-row">
                  <label className="check"><input type="checkbox" name={`team_${m.slug}`} defaultChecked={!!t} /> {m.name}</label>
                  <label className="field"><span className="sr-only">{m.name}’s role</span><input name={`role_${m.slug}`} defaultValue={t?.role ?? ''} placeholder="built the site" /></label>
                </div>
              );
            })}
          </fieldset>
          <div><Submit>Save project</Submit></div>
        </ActionForm>
      </section>

      <section className="admin-section" aria-labelledby="danger-h">
        <h2 id="danger-h" className="type-h3">Delete</h2>
        <form action={deleteProjectAction.bind(null, id)}>
          <button className="btn btn-ghost btn-danger">Delete this project and its images</button>
        </form>
      </section>
    </>
  );
}
