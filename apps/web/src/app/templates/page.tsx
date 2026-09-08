const templates=[{id:"editorial-ivory",name:"Editorial Ivory",tier:"Signature"},{id:"botanical-journal",name:"Botanical Journal",tier:"Premium"}];
export default function Page(){return <main><h1>Pilih desain yang terasa seperti Anda</h1><ul>{templates.map(t=><li key={t.id}><h2>{t.name}</h2><p>{t.tier}</p><a href={`/templates/${t.id}`}>Lihat demo</a></li>)}</ul></main>}
