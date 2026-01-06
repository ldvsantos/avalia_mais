import{d as p,$ as u,y as f,f as i,o as r,g as e,t as a,F as h,Z as v,i as g,e as x,a0 as N}from"../modules/vue-CM72cxEe.js";import{u as b,j as y,c as _,b as k}from"../index-7Z4G5jGP.js";import{N as D}from"./NoteDisplay-CPIUsrTK.js";import"../modules/shiki-PW05pg_G.js";const L=p({__name:"print",setup(m,{expose:n}){n();const{slides:l,total:o}=b();u(`
@page {
  size: A4;
  margin-top: 1.5cm;
  margin-bottom: 1cm;
}
* {
  -webkit-print-color-adjust: exact;
}
html,
html body,
html #app,
html #page-root {
  height: auto;
  overflow: auto !important;
}
`),y({title:`Notes - ${_.title}`});const d=f(()=>l.value.map(t=>{var s;return(s=t.meta)==null?void 0:s.slide}).filter(t=>t!==void 0&&t.noteHTML!=="")),c={slides:l,total:o,slidesWithNote:d,get configs(){return _},NoteDisplay:D};return Object.defineProperty(c,"__isScriptSetup",{enumerable:!1,value:!0}),c}}),S={id:"page-root"},T={class:"m-4"},j={class:"mb-10"},w={class:"text-4xl font-bold mt-2"},C={class:"opacity-50"},V={class:"text-lg"},B={class:"font-bold flex gap-2"},H={class:"opacity-50"},O={key:0,class:"border-main mb-8"};function W(m,n,l,o,d,c){return r(),i("div",S,[e("div",T,[e("div",j,[e("h1",w,a(o.configs.title),1),e("div",C,a(new Date().toLocaleString()),1)]),(r(!0),i(h,null,v(o.slidesWithNote,(t,s)=>(r(),i("div",{key:s,class:"flex flex-col gap-4 break-inside-avoid-page"},[e("div",null,[e("h2",V,[e("div",B,[e("div",H,a(t==null?void 0:t.no)+"/"+a(o.total),1),N(" "+a(t==null?void 0:t.title)+" ",1),n[0]||(n[0]=e("div",{class:"flex-auto"},null,-1))])]),x(o.NoteDisplay,{"note-html":t.noteHTML,class:"max-w-full"},null,8,["note-html"])]),s<o.slidesWithNote.length-1?(r(),i("hr",O)):g("v-if",!0)]))),128))])])}const A=k(L,[["render",W],["__file","C:/Users/vidal/OneDrive/Documentos/13 - CLONEGIT/site_avalia_mais/projeto_centelha/apresentacao-slidev/node_modules/@slidev/client/pages/presenter/print.vue"]]);export{A as default};
