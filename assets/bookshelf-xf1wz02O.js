import{c as A,q as D,r as c,j as e,L as M}from"./index-DW4ukOuK.js";import{ad as F,g as E,ae as X,af as Y,i as q,B as S,U as G,t as r,ag as V,ah as H}from"./index-BBn3iPL9.js";import{D as J}from"./download-C8b5-zco.js";import{L as x}from"./lock-Cv38C4Fl.js";const O=[["path",{d:"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z",key:"18887p"}]],Q=A("message-square",O);function ae(){const R=D(),[v,k]=c.useState(null),{data:L=[]}=F(),{data:w=[]}=E(),b=X(),j=Y(),p=s=>(s||"").trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'“]/g,"").replace(/\s+/g," "),[h,n]=c.useState(""),[m,d]=c.useState(!1),[W,u]=c.useState(null),[B,y]=c.useState(!1),[_,N]=c.useState(!1),g=w.some(s=>p(s)==="i seek greater knowledge"),f=w.some(s=>p(s)==="please show me the way"),[a,i]=c.useState(null),C=c.useRef(null),T=[{id:"grimoire",title:"The Grimoire",subtitle:"Character & campaign manager",coverImage:"the_grimoire_spine.png",path:"/grimoire",style:"bg-[#18110a] border-amber-900/35"},{id:"codex",title:"Veridia Codex",subtitle:"World lore and land archives",coverImage:"veridia_codex_spine.png",path:"/codex",style:"bg-[#1f1610] border-amber-950/40"},{id:"chronicle",title:"Chronicle of the Creator",subtitle:"Dungeon Master rules & tools",coverImage:"chronicle_spine.png",path:"/chronicle",style:"bg-[#0b141a] border-sky-950/40"}],I=s=>{if(s.preventDefault(),!h.trim())return;const t=p(h);if(t==="i accept the form i am given"){u("all"),i("all"),r.success("The form has been accepted. The Archive listens."),n(""),setTimeout(()=>{i(null),u(null)},5e3);return}if(t==="i seek greater knowledge"){if(g){r.info("The Codex has already been unlocked."),n("");return}b.mutate("i seek greater knowledge",{onSuccess:()=>{y(!0),i("codex"),n(""),r.success("The seal of Veridia has broken! The Codex is unlocked."),setTimeout(()=>{i(null),y(!1)},3e3)}});return}if(t==="please show me the way"){if(f){r.info("The Chronicle of the Creator has already been unlocked."),n("");return}b.mutate("please show me the way",{onSuccess:()=>{N(!0),i("chronicle"),n(""),r.success("The Creator's seal has broken! The Chronicle is unlocked."),setTimeout(()=>{i(null),N(!1)},3e3)}});return}if(t==="seal the archives"){let o=!1;g&&(j.mutate("i seek greater knowledge"),o=!0),f&&(j.mutate("please show me the way"),o=!0),o?r.success("The tomes have been sealed and hidden once more."):r.info("The archives are already sealed."),n("");return}const l=L.find(o=>o.secretPassword&&p(o.secretPassword)===t);if(l){const o=l.category==="bestiary"||l.subcategory==="bestiary-monsters"?"grimoire":"codex";b.mutate(l.secretPassword,{onSuccess:()=>{u(o),i(o),r.success(`Seal broken! Unlocked compendium note: "${l.title}"`),n(""),setTimeout(()=>{i(null),u(null)},5e3)}})}else d(!0),r.error("The hidden words ring hollow. The Archive remains silent."),setTimeout(()=>d(!1),600)},P=()=>{try{V(),r.success("Campaign archive exported successfully!")}catch{r.error("Failed to export archive.")}},U=()=>{C.current?.click()},$=s=>{const t=s.target.files?.[0];if(!t)return;const l=new FileReader;l.onload=async o=>{try{const z=JSON.parse(o.target?.result);H(JSON.stringify(z)),await R.invalidateQueries(),r.success("Campaign archive restored successfully!")}catch{r.error("Invalid file format. Import requires a valid campaign archive.")}},l.readAsText(t)};return e.jsxs("div",{className:"min-h-[92vh] bg-[#050302] text-stone-100 flex flex-col justify-between p-6 relative font-serif select-none max-w-7xl mx-auto overflow-hidden",children:[e.jsx("style",{children:`
        .spotlight {
          background: radial-gradient(circle at 50% 30%, rgba(217, 119, 6, 0.04) 0%, rgba(0, 0, 0, 0.85) 75%);
        }
        .book-container {
          perspective: 1000px;
        }
        .wood-grain {
          background: linear-gradient(180deg, #1c130d 0%, #100a06 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .wood-grain::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(90deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 40px, rgba(0,0,0,0.15) 45px, rgba(0,0,0,0) 50px);
          opacity: 0.4;
          pointer-events: none;
        }
        .parchment-glow {
          box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.8),
                      0 0 40px 5px rgba(217, 119, 6, 0.15);
        }

        /* ── Metallic Gold Foil Sheen sweep keyframe ── */
        @keyframes foil-shine {
          0% { transform: translateX(-100%) rotate(25deg); }
          100% { transform: translateX(200%) rotate(25deg); }
        }
        .foil-shine-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 215, 0, 0.12) 30%,
            rgba(255, 255, 255, 0.35) 50%,
            rgba(255, 215, 0, 0.12) 70%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: translateX(-100%) rotate(25deg);
          pointer-events: none;
          z-index: 5;
        }
        .group:hover .foil-shine-overlay {
          animation: foil-shine 1.5s cubic-bezier(0.25, 1, 0.25, 1) forwards;
        }

        /* ── Realistic 3D Depth Shadows ── */
        .book-shadow {
          box-shadow: 5px 25px 35px rgba(0,0,0,0.7);
          transition: box-shadow 0.4s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .group:hover .book-shadow {
          transform: scale(1.025);
          box-shadow: 12px 35px 50px rgba(0, 0, 0, 0.85);
        }

        /* ── Smoldering Rune Glowing Fire Keyframes ── */
        @keyframes rune-smolder {
          0%, 100% {
            text-shadow: 0 0 5px rgba(239, 68, 68, 0.35), 0 0 12px rgba(245, 158, 11, 0.2);
            color: rgba(120, 53, 4, 0.35);
          }
          50% {
            text-shadow: 0 0 10px rgba(239, 68, 68, 0.95), 0 0 25px rgba(245, 158, 11, 0.98), 0 0 35px rgba(251, 146, 60, 0.85);
            color: rgba(254, 215, 170, 0.98);
          }
        }
        .animate-rune-smolder {
          animation: rune-smolder 2.2s infinite ease-in-out;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.6s cubic-bezier(.36,.07,.19,.97) both;
        }

        /* ── Lock breaking and falling away ── */
        @keyframes lock-break-fall {
          0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
          20% { transform: translateY(-10px) scale(1.1) rotate(-10deg); opacity: 1; }
          40% { transform: translateY(0) scale(1) rotate(15deg); opacity: 0.9; }
          100% { transform: translateY(120px) scale(0.8) rotate(45deg); opacity: 0; }
        }
        .animate-lock-break {
          animation: lock-break-fall 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }

        /* ── Border fade and shrink ── */
        @keyframes border-dissolve {
          0% { border-color: rgba(120, 113, 108, 0.4); opacity: 0.4; }
          100% { border-color: rgba(120, 113, 108, 0); opacity: 0; }
        }
        .animate-border-dissolve {
          animation: border-dissolve 1.2s ease-out forwards;
        }

        /* ── Book fading into existence ── */
        @keyframes book-materialize {
          0% { opacity: 0; transform: scale(0.9) rotateY(-30deg); filter: blur(8px); }
          50% { opacity: 0.5; filter: blur(3px); }
          100% { opacity: 1; transform: scale(1) rotateY(0); filter: blur(0); }
        }
        .animate-book-materialize {
          animation: book-materialize 2.2s cubic-bezier(0.19, 1, 0.22, 1) forwards;
        }
      `}),e.jsx("div",{className:"absolute inset-0 spotlight pointer-events-none"}),e.jsx("div",{className:"absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-950/5 via-[#0d0907] to-[#050302] pointer-events-none"}),e.jsxs("div",{className:"text-center space-y-3 z-10 max-w-2xl mx-auto mt-2",children:[e.jsx("h1",{className:"text-4xl sm:text-5xl font-serif font-extrabold tracking-[0.3em] uppercase bg-gradient-to-r from-amber-600 via-stone-200 to-amber-600 bg-clip-text text-transparent drop-shadow-md",children:"The Archive"}),e.jsx("div",{className:"h-[1px] w-48 bg-gradient-to-r from-transparent via-amber-600/50 to-transparent mx-auto"}),e.jsx("p",{className:"text-stone-400 font-serif text-sm tracking-wider italic",children:"“What is stored here is more than power. The books are listening—and they remember every word.”"})]}),e.jsxs("div",{className:"bg-card/45 backdrop-blur-md border border-border/40 p-3 max-w-2xl mx-auto flex items-center justify-between gap-4 rounded-lg shadow-sm mt-4 z-10 w-full",children:[e.jsx("div",{className:"flex items-center gap-2.5 flex-wrap",children:e.jsx(q,{})}),e.jsxs("div",{className:"flex items-center gap-2.5",children:[e.jsx("input",{type:"file",ref:C,onChange:$,accept:".archive,.json",className:"hidden"}),e.jsxs(S,{variant:"outline",size:"sm",onClick:U,className:"h-8 text-xs font-serif border border-primary/45 text-primary hover:bg-primary/10 rounded-md cursor-pointer flex items-center gap-1.5 font-bold transition-all",title:"Restore campaign archive (.archive, .json)",children:[e.jsx(G,{className:"w-3.5 h-3.5"})," Import Backup"]}),e.jsxs(S,{variant:"outline",size:"sm",onClick:P,className:"h-8 text-xs font-serif border border-primary/45 text-primary hover:bg-primary/10 rounded-md cursor-pointer flex items-center gap-1.5 font-bold transition-all",title:"Export campaign archive (.archive)",children:[e.jsx(J,{className:"w-3.5 h-3.5"})," Export Backup"]})]})]}),e.jsx("form",{onSubmit:I,className:"max-w-xs mx-auto w-full text-center mt-6 z-10",children:e.jsxs("div",{className:"relative",children:[e.jsx("input",{type:"text",value:h,onChange:s=>n(s.target.value),placeholder:"Speak your mind",className:`w-full bg-[#120e0a]/90 border border-amber-900/30 rounded-none h-8 text-center text-xs font-serif text-amber-200 placeholder:text-stone-700 placeholder:italic focus:outline-none focus:border-amber-600/60 focus:ring-1 focus:ring-amber-600/20 transition-all ${m?"animate-shake border-red-900":""}`}),e.jsx(Q,{className:"w-3.5 h-3.5 text-stone-300/80 absolute right-2.5 top-1/2 -translate-y-1/2"})]})}),e.jsxs("div",{className:"w-full max-w-4xl mx-auto z-10 my-4 space-y-1",children:[e.jsxs("div",{className:"grid grid-cols-2 sm:grid-cols-6 gap-3 sm:gap-6 px-4 items-end justify-center min-h-[320px] pb-1 max-w-md sm:max-w-none mx-auto",children:[T.map(s=>{if(s.id==="codex"){if(B)return e.jsxs("div",{className:"col-span-1 flex flex-col items-center gap-2 h-[300px] justify-end relative",children:[e.jsxs("div",{className:"book-container h-[260px] flex items-end relative w-[96px] sm:w-[86px]",children:[e.jsxs("div",{className:"absolute inset-x-0 bottom-0 h-[260px] border border-dashed border-stone-800/40 rounded-sm flex flex-col items-center justify-center text-center gap-1.5 bg-stone-950/10 animate-border-dissolve z-10",children:[e.jsx(x,{className:"w-4.5 h-4.5 text-stone-700 animate-lock-break"}),e.jsx("span",{className:"text-[8px] font-mono tracking-widest text-stone-700 uppercase animate-border-dissolve",children:"Locked"})]}),e.jsxs("div",{className:"book-shadow w-full h-[260px] relative border border-t-2 border-b-2 bg-[#1f1610] border-amber-950/40 overflow-hidden animate-book-materialize",style:{backgroundImage:"linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.25)), url(veridia_codex_spine.png)",backgroundSize:"cover",backgroundPosition:"center",borderTopRightRadius:"var(--radius)",borderBottomRightRadius:"var(--radius)",borderTopLeftRadius:"2px",borderBottomLeftRadius:"2px"},children:[e.jsx("div",{className:"foil-shine-overlay"}),e.jsx("div",{className:"absolute inset-1.5 border border-amber-500/10 pointer-events-none"}),e.jsx("div",{className:"absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/60 via-black/10 to-transparent"})]})]}),e.jsx("div",{className:"text-center pb-1",children:e.jsx("span",{className:"font-serif text-xs font-bold uppercase tracking-[0.25em] text-amber-500 duration-1000 animate-pulse",children:"Codex"})})]},s.id);if(!g)return e.jsxs("button",{type:"button",className:"col-span-1 flex flex-col items-center gap-2 h-[300px] justify-end cursor-not-allowed group opacity-55 bg-transparent border-0",onClick:()=>{r.info("The Codex is sealed. Speak the passphrase to unlock its secrets."),d(!0),setTimeout(()=>d(!1),600)},children:[e.jsx("div",{className:"book-container h-[260px] flex items-end",children:e.jsxs("div",{className:`w-[96px] sm:w-[86px] h-[260px] border border-dashed border-stone-850/40 rounded-sm flex flex-col items-center justify-center text-center gap-1.5 bg-stone-950/20 shadow-inner ${m?"animate-shake border-red-900/60":""}`,children:[e.jsx(x,{className:`w-4 h-4 text-stone-600 ${m?"text-red-500":""}`}),e.jsx("span",{className:"text-[8px] font-mono tracking-widest text-stone-600 uppercase",children:"Locked"})]})}),e.jsx("div",{className:"text-center pb-1",children:e.jsx("span",{className:"font-mono text-xs font-bold uppercase tracking-[0.25em] text-stone-600/50",children:"᚛ᚦᚨᚱᚠ᚜"})})]},s.id)}if(s.id==="chronicle"){if(_)return e.jsxs("div",{className:"col-span-1 flex flex-col items-center gap-2 h-[300px] justify-end relative",children:[e.jsxs("div",{className:"book-container h-[260px] flex items-end relative w-[96px] sm:w-[86px]",children:[e.jsxs("div",{className:"absolute inset-x-0 bottom-0 h-[260px] border border-dashed border-stone-800/40 rounded-sm flex flex-col items-center justify-center text-center gap-1.5 bg-stone-950/10 animate-border-dissolve z-10",children:[e.jsx(x,{className:"w-4.5 h-4.5 text-stone-700 animate-lock-break"}),e.jsx("span",{className:"text-[8px] font-mono tracking-widest text-stone-700 uppercase animate-border-dissolve",children:"Locked"})]}),e.jsxs("div",{className:"book-shadow w-full h-[260px] relative border border-t-2 border-b-2 bg-[#0b141a] border-sky-950/40 overflow-hidden animate-book-materialize shadow-2xl",style:{backgroundImage:"linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.25)), url(chronicle_spine.png)",backgroundSize:"cover",backgroundPosition:"center",borderTopRightRadius:"var(--radius)",borderBottomRightRadius:"var(--radius)",borderTopLeftRadius:"2px",borderBottomLeftRadius:"2px"},children:[e.jsx("div",{className:"foil-shine-overlay"}),e.jsx("div",{className:"absolute inset-1.5 border border-sky-500/10 pointer-events-none"}),e.jsx("div",{className:"absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/60 via-black/10 to-transparent"})]})]}),e.jsx("div",{className:"text-center pb-1",children:e.jsx("span",{className:"font-serif text-xs font-bold uppercase tracking-[0.25em] text-sky-500 duration-1000 animate-pulse",children:"Chronicle"})})]},s.id);if(!f)return e.jsxs("button",{type:"button",className:"col-span-1 flex flex-col items-center gap-2 h-[300px] justify-end cursor-not-allowed group opacity-55 bg-transparent border-0",onClick:()=>{r.info("The Chronicle is sealed. Speak the passphrase to unlock its secrets."),d(!0),setTimeout(()=>d(!1),600)},children:[e.jsx("div",{className:"book-container h-[260px] flex items-end",children:e.jsxs("div",{className:`w-[96px] sm:w-[86px] h-[260px] border border-dashed border-stone-850/40 rounded-sm flex flex-col items-center justify-center text-center gap-1.5 bg-stone-950/20 shadow-inner ${m?"animate-shake border-red-900/60":""}`,children:[e.jsx(x,{className:`w-4 h-4 text-stone-600 ${m?"text-red-500":""}`}),e.jsx("span",{className:"text-[8px] font-mono tracking-widest text-stone-600 uppercase",children:"Locked"})]})}),e.jsx("div",{className:"text-center pb-1",children:e.jsx("span",{className:"font-mono text-xs font-bold uppercase tracking-[0.25em] text-stone-600/50",children:"᚛ᚢᚦᚨᚱᚦ᚜"})})]},s.id)}return e.jsxs(M,{href:s.path,"aria-label":`${s.title}: ${s.subtitle}`,className:"col-span-1 flex flex-col items-center gap-2 cursor-pointer group h-[300px] justify-end",onMouseEnter:()=>k(s.id),onMouseLeave:()=>k(null),children:[e.jsx("div",{className:"book-container h-[260px] flex items-end",children:e.jsxs("div",{className:`book-shadow w-[96px] sm:w-[86px] h-[260px] relative border border-t-2 border-b-2 ${s.style} overflow-hidden`,style:{backgroundImage:`linear-gradient(rgba(0,0,0,0.15), rgba(0,0,0,0.25)), url(${s.coverImage})`,backgroundSize:"cover",backgroundPosition:"center",borderTopRightRadius:"var(--radius)",borderBottomRightRadius:"var(--radius)",borderTopLeftRadius:"2px",borderBottomLeftRadius:"2px"},children:[e.jsx("div",{className:"foil-shine-overlay"}),e.jsx("div",{className:"absolute inset-1.5 border border-amber-500/10 pointer-events-none group-hover:border-amber-500/25 transition-colors duration-500"}),e.jsx("div",{className:"absolute left-0 top-0 bottom-0 w-2.5 bg-gradient-to-r from-black/60 via-black/10 to-transparent"})]})}),e.jsx("div",{className:"text-center pb-1",children:e.jsx("span",{className:"font-serif text-xs font-bold uppercase tracking-[0.25em] text-stone-500 group-hover:text-amber-500 transition-colors duration-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]",children:s.id==="grimoire"?"Grimoire":s.id==="codex"?"Codex":"Chronicle"})})]},s.id)}),Array(3).fill(null).map((s,t)=>e.jsx("div",{className:"col-span-1 hidden sm:flex justify-center h-[300px] items-end pb-7 pointer-events-none",children:e.jsxs("div",{className:"w-[110px] h-[230px] border border-dashed border-stone-800/40 rounded-sm flex flex-col items-center justify-center text-center gap-1.5 opacity-40 bg-stone-950/10",children:[e.jsx(x,{className:"w-4.5 h-4.5 text-stone-700"}),e.jsx("span",{className:"text-[8px] font-mono tracking-widest text-stone-700 uppercase",children:"Locked"})]})},`empty-${t}`))]}),e.jsxs("div",{className:"relative z-20",children:[e.jsxs("div",{className:"wood-grain w-full h-8 border-t border-amber-700/30 rounded-t-sm shadow-[0_15px_30px_rgba(0,0,0,0.85)] relative flex items-center justify-between px-4",children:[e.jsx("div",{className:"absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-600/45 to-transparent"}),e.jsx("div",{className:"absolute inset-x-0 bottom-0 h-[2px] bg-black/60"}),e.jsxs("div",{className:"flex-1 flex justify-center items-center gap-6 font-mono text-sm tracking-widest text-[#2c1d12] select-none pointer-events-none",children:[e.jsx("span",{className:a==="grimoire"||a==="all"?"animate-rune-smolder":"",children:"᚛"}),e.jsx("span",{className:a==="grimoire"||a==="all"?"animate-rune-smolder":"",children:"ᚠ"}),e.jsx("span",{className:a==="grimoire"||a==="all"?"animate-rune-smolder":"",children:"ᚢ"}),e.jsx("span",{className:a==="all"?"animate-rune-smolder":"",children:"ᚦ"}),e.jsx("span",{className:a==="codex"||a==="chronicle"||a==="all"?"animate-rune-smolder":"",children:"ᚨ"}),e.jsx("span",{className:a==="codex"||a==="chronicle"||a==="all"?"animate-rune-smolder":"",children:"ᚱ"}),e.jsx("span",{className:a==="codex"||a==="chronicle"||a==="all"?"animate-rune-smolder":"",children:"᚜"})]}),e.jsx("div",{className:"absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-mono text-amber-950/30 select-none uppercase tracking-widest pointer-events-none",children:"Crafted by Lukie Seven · Mark 66"})]}),e.jsx("div",{className:"wood-grain w-full h-4 bg-gradient-to-b from-black/80 to-transparent"})]})]}),e.jsx("div",{className:"w-full max-w-xl mx-auto z-10 min-h-[140px] flex items-center justify-center transition-all duration-300",children:v?(()=>{const s=T.find(t=>t.id===v);return s?e.jsxs("div",{className:"w-full bg-[#16110c] border border-amber-900/45 p-6 shadow-2xl relative parchment-glow animate-smooth-fade-in",children:[e.jsx("div",{className:"absolute inset-1 border border-amber-950/20 pointer-events-none"}),e.jsx("div",{className:"absolute top-2 left-2 right-2 bottom-2 border border-dashed border-amber-900/15 pointer-events-none"}),e.jsxs("div",{className:"text-center space-y-2 z-10 relative",children:[e.jsx("h3",{className:"text-amber-500 text-lg font-bold uppercase tracking-wider",children:s.title}),e.jsx("span",{className:"text-[10px] font-mono uppercase text-stone-500 tracking-widest block",children:s.subtitle}),e.jsx("div",{className:"h-[1px] w-24 bg-amber-900/20 mx-auto my-2"}),e.jsx("p",{className:"text-stone-300 text-xs leading-relaxed max-w-sm mx-auto font-serif",children:s.id==="grimoire"?"Consult the codices of active heroes. Track character stats, customize attributes, manage spell inventories, calculate Crit Chains, and roll active campaign D20 checks.":s.id==="codex"?"Chronicle the world map of Cormant. Filter taxonomy directories for cities, settlements, dungeons, monster bestiaries, and push lore items directly to character lore logs.":"The Dungeon Master's guide to Cormant. Run game sessions using rules directories, combat trackers, NPC/loot generators, sound mixers, and workspace boards."})]})]}):null})():e.jsx("div",{className:"text-center max-w-xs mx-auto py-8",children:e.jsx("span",{className:"text-stone-600 text-[10px] font-mono uppercase tracking-[0.25em] block animate-pulse",children:"Select a chronicle from the bookcase"})})}),e.jsx("footer",{className:"mt-12 mb-4 border-t border-stone-900/45 pt-4 text-center z-10 w-full max-w-xl mx-auto",children:e.jsx("p",{className:"text-[10px] font-mono text-stone-600/35 hover:text-stone-400/80 transition-colors tracking-widest uppercase",children:"Lovingly crafted by LukieSeven — Mark 66"})})]})}export{ae as default};
