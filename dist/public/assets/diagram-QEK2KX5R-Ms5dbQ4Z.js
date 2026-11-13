import{s as k,g as R,t as F,q as I,a as _,b as E,_ as l,K as D,z as G,F as y,G as z,H as C,l as P,a1 as H}from"./mermaid.core-B7Ax5alR.js";import{p as V}from"./chunk-4BX2VUAB-BuNjtrWP.js";import{p as W}from"./treemap-KMMF4GRG-Bp7Aii0M.js";import"./index-BhWUXBna.js";import"./purify.es-CAi2OJFm.js";import"./PlatformDashboard-CiFTQX_L.js";import"./badge-Bxm8QV0M.js";import"./DashboardLayout-CuL7jMXb.js";import"./circle-x-WurG5vKC.js";import"./PaymentReminderBanner-D1_HaI9B.js";import"./message-circle-LF3wWO3P.js";import"./download-vdwAIUiH.js";import"./Combination-B4kqTkkh.js";import"./key-round-CLRPKgXD.js";import"./BrandLogo-CszUrK7c.js";import"./file-text-XB_js9lX.js";import"./circle-check-CzhJhP6p.js";import"./shield-check-DOBvGVUa.js";import"./send-DNeCt2vT.js";import"./textarea-Du266CzY.js";import"./dialog-B3f2VknQ.js";import"./useComposition-DiOF8ObE.js";import"./index-BdQq_4o_.js";import"./imageCompress-gICoTnOH.js";import"./image-DjMdJT0L.js";import"./user-CAu7074i.js";import"./activity-BkvVzLoo.js";import"./search-CNMdxzHl.js";import"./play-C0EXtUfp.js";import"./clipboard-check-D5b8pWsh.js";import"./_baseUniq-qmC03YAQ.js";import"./_basePickBy-BQSSLeV-.js";import"./clone-DHMHLpMa.js";var h={showLegend:!0,ticks:5,max:null,min:0,graticule:"circle"},w={axes:[],curves:[],options:h},g=structuredClone(w),B=z.radar,j=l(()=>y({...B,...C().radar}),"getConfig"),b=l(()=>g.axes,"getAxes"),q=l(()=>g.curves,"getCurves"),K=l(()=>g.options,"getOptions"),N=l(a=>{g.axes=a.map(t=>({name:t.name,label:t.label??t.name}))},"setAxes"),U=l(a=>{g.curves=a.map(t=>({name:t.name,label:t.label??t.name,entries:X(t.entries)}))},"setCurves"),X=l(a=>{if(a[0].axis==null)return a.map(e=>e.value);const t=b();if(t.length===0)throw new Error("Axes must be populated before curves for reference entries");return t.map(e=>{const r=a.find(s=>s.axis?.$refText===e.name);if(r===void 0)throw new Error("Missing entry for axis "+e.label);return r.value})},"computeCurveEntries"),Y=l(a=>{const t=a.reduce((e,r)=>(e[r.name]=r,e),{});g.options={showLegend:t.showLegend?.value??h.showLegend,ticks:t.ticks?.value??h.ticks,max:t.max?.value??h.max,min:t.min?.value??h.min,graticule:t.graticule?.value??h.graticule}},"setOptions"),Z=l(()=>{G(),g=structuredClone(w)},"clear"),$={getAxes:b,getCurves:q,getOptions:K,setAxes:N,setCurves:U,setOptions:Y,getConfig:j,clear:Z,setAccTitle:E,getAccTitle:_,setDiagramTitle:I,getDiagramTitle:F,getAccDescription:R,setAccDescription:k},J=l(a=>{V(a,$);const{axes:t,curves:e,options:r}=a;$.setAxes(t),$.setCurves(e),$.setOptions(r)},"populate"),Q={parse:l(async a=>{const t=await W("radar",a);P.debug(t),J(t)},"parse")},tt=l((a,t,e,r)=>{const s=r.db,n=s.getAxes(),i=s.getCurves(),o=s.getOptions(),c=s.getConfig(),p=s.getDiagramTitle(),m=D(t),d=et(m,c),u=o.max??Math.max(...i.map(f=>Math.max(...f.entries))),x=o.min,v=Math.min(c.width,c.height)/2;at(d,n,v,o.ticks,o.graticule),rt(d,n,v,c),M(d,n,i,x,u,o.graticule,c),T(d,i,o.showLegend,c),d.append("text").attr("class","radarTitle").text(p).attr("x",0).attr("y",-c.height/2-c.marginTop)},"draw"),et=l((a,t)=>{const e=t.width+t.marginLeft+t.marginRight,r=t.height+t.marginTop+t.marginBottom,s={x:t.marginLeft+t.width/2,y:t.marginTop+t.height/2};return a.attr("viewbox",`0 0 ${e} ${r}`).attr("width",e).attr("height",r),a.append("g").attr("transform",`translate(${s.x}, ${s.y})`)},"drawFrame"),at=l((a,t,e,r,s)=>{if(s==="circle")for(let n=0;n<r;n++){const i=e*(n+1)/r;a.append("circle").attr("r",i).attr("class","radarGraticule")}else if(s==="polygon"){const n=t.length;for(let i=0;i<r;i++){const o=e*(i+1)/r,c=t.map((p,m)=>{const d=2*m*Math.PI/n-Math.PI/2,u=o*Math.cos(d),x=o*Math.sin(d);return`${u},${x}`}).join(" ");a.append("polygon").attr("points",c).attr("class","radarGraticule")}}},"drawGraticule"),rt=l((a,t,e,r)=>{const s=t.length;for(let n=0;n<s;n++){const i=t[n].label,o=2*n*Math.PI/s-Math.PI/2;a.append("line").attr("x1",0).attr("y1",0).attr("x2",e*r.axisScaleFactor*Math.cos(o)).attr("y2",e*r.axisScaleFactor*Math.sin(o)).attr("class","radarAxisLine"),a.append("text").text(i).attr("x",e*r.axisLabelFactor*Math.cos(o)).attr("y",e*r.axisLabelFactor*Math.sin(o)).attr("class","radarAxisLabel")}},"drawAxes");function M(a,t,e,r,s,n,i){const o=t.length,c=Math.min(i.width,i.height)/2;e.forEach((p,m)=>{if(p.entries.length!==o)return;const d=p.entries.map((u,x)=>{const v=2*Math.PI*x/o-Math.PI/2,f=A(u,r,s,c),O=f*Math.cos(v),S=f*Math.sin(v);return{x:O,y:S}});n==="circle"?a.append("path").attr("d",L(d,i.curveTension)).attr("class",`radarCurve-${m}`):n==="polygon"&&a.append("polygon").attr("points",d.map(u=>`${u.x},${u.y}`).join(" ")).attr("class",`radarCurve-${m}`)})}l(M,"drawCurves");function A(a,t,e,r){const s=Math.min(Math.max(a,t),e);return r*(s-t)/(e-t)}l(A,"relativeRadius");function L(a,t){const e=a.length;let r=`M${a[0].x},${a[0].y}`;for(let s=0;s<e;s++){const n=a[(s-1+e)%e],i=a[s],o=a[(s+1)%e],c=a[(s+2)%e],p={x:i.x+(o.x-n.x)*t,y:i.y+(o.y-n.y)*t},m={x:o.x-(c.x-i.x)*t,y:o.y-(c.y-i.y)*t};r+=` C${p.x},${p.y} ${m.x},${m.y} ${o.x},${o.y}`}return`${r} Z`}l(L,"closedRoundCurve");function T(a,t,e,r){if(!e)return;const s=(r.width/2+r.marginRight)*3/4,n=-(r.height/2+r.marginTop)*3/4,i=20;t.forEach((o,c)=>{const p=a.append("g").attr("transform",`translate(${s}, ${n+c*i})`);p.append("rect").attr("width",12).attr("height",12).attr("class",`radarLegendBox-${c}`),p.append("text").attr("x",16).attr("y",0).attr("class","radarLegendText").text(o.label)})}l(T,"drawLegend");var st={draw:tt},ot=l((a,t)=>{let e="";for(let r=0;r<a.THEME_COLOR_LIMIT;r++){const s=a[`cScale${r}`];e+=`
		.radarCurve-${r} {
			color: ${s};
			fill: ${s};
			fill-opacity: ${t.curveOpacity};
			stroke: ${s};
			stroke-width: ${t.curveStrokeWidth};
		}
		.radarLegendBox-${r} {
			fill: ${s};
			fill-opacity: ${t.curveOpacity};
			stroke: ${s};
		}
		`}return e},"genIndexStyles"),nt=l(a=>{const t=H(),e=C(),r=y(t,e.themeVariables),s=y(r.radar,a);return{themeVariables:r,radarOptions:s}},"buildRadarStyleOptions"),it=l(({radar:a}={})=>{const{themeVariables:t,radarOptions:e}=nt(a);return`
	.radarTitle {
		font-size: ${t.fontSize};
		color: ${t.titleColor};
		dominant-baseline: hanging;
		text-anchor: middle;
	}
	.radarAxisLine {
		stroke: ${e.axisColor};
		stroke-width: ${e.axisStrokeWidth};
	}
	.radarAxisLabel {
		dominant-baseline: middle;
		text-anchor: middle;
		font-size: ${e.axisLabelFontSize}px;
		color: ${e.axisColor};
	}
	.radarGraticule {
		fill: ${e.graticuleColor};
		fill-opacity: ${e.graticuleOpacity};
		stroke: ${e.graticuleColor};
		stroke-width: ${e.graticuleStrokeWidth};
	}
	.radarLegendText {
		text-anchor: start;
		font-size: ${e.legendFontSize}px;
		dominant-baseline: hanging;
	}
	${ot(t,e)}
	`},"styles"),Vt={parser:Q,db:$,renderer:st,styles:it};export{Vt as diagram};
