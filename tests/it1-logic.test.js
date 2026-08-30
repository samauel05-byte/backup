const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const html=fs.readFileSync('frontend/itbis-web.html','utf8');
const code=html.match(/<script>\s*'use strict';([\s\S]*?)<\/script>/)[0].replace(/^<script>/,'').replace(/<\/script>$/,'');
const elements=new Map();
const element=()=>new Proxy({hidden:false,value:'',textContent:'',innerHTML:'',files:[],className:'',style:{},classList:{add(){},remove(){}},addEventListener(){},appendChild(){},remove(){},click(){},querySelector(){return null;}},{get:(o,k)=>k in o?o[k]:()=>{}});
const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll(){return[];},createElement:element,body:element()};
const context={console,document,window:{print(){}},localStorage:{getItem(){return null;},setItem(){}},pdfjsLib:{GlobalWorkerOptions:{}},Intl,URL:{createObjectURL(){return'';},revokeObjectURL(){}},setTimeout(){return 0;},clearTimeout(){},fetch(){throw new Error('fetch inesperado');},FileReader:function(){},XLSX:{},JSZip:{},Papa:{}};
vm.createContext(context);
vm.runInContext(code,context);
elements.get('in-confirm-overlap').checked=true;

const explicit=vm.runInContext(`process607(${JSON.stringify([
  {'NCF o E-NCF':' B-01 000000001','Total Monto Facturado':1180,'ITBIS Facturado':180,'Monto Facturado en Tarjeta Debito Credito':0,'Monto Facturado en Efectivo':1180},
  {'NCF o E-NCF':'B02000000001','Total Monto Facturado':590,'ITBIS Facturado':90,'Monto Facturado en Tarjeta Debito Credito':590,'Monto Facturado en Efectivo':0},
  {'NCF o E-NCF':'E320000000001','Total Monto Facturado':236,'ITBIS Facturado':36,'Monto Facturado en Tarjeta Debito Credito':236,'Monto Facturado en Efectivo':0},
])})`,context);
context.explicit=explicit;
const explicitBreakdown=JSON.parse(vm.runInContext(`JSON.stringify(getIT1SalesBreakdown(explicit.summary))`,context));
if(process.env.DEBUG_IT1) console.log(JSON.stringify({summary:explicit.summary,breakdown:explicitBreakdown},null,2));
assert.strictEqual(explicitBreakdown.total,2006);
assert.strictEqual(explicitBreakdown.payments.card,826);
assert.strictEqual(explicitBreakdown.payments.cash,1180);
assert.strictEqual(explicitBreakdown.discrepancy,0);
assert.strictEqual(explicit.summary.ncfGroups.credito.monto,1000);
assert.strictEqual(explicit.summary.ncfGroups.consumo.monto,700);
assert.strictEqual(explicit.summary.ncfGroups.sinClasificar.count,0);
context.explicit=explicit;
vm.runInContext(`CARD_STATE.azul={baseGravable:750,totalSujetoRetencion:885,retenido:17.7};`,context);
const explicitNCF=JSON.parse(vm.runInContext(`JSON.stringify(getIT1NCFBreakdown(explicit.summary))`,context));
const explicitConsolidated=JSON.parse(vm.runInContext(`JSON.stringify(getCardConsolidation(explicit.summary))`,context));
assert.strictEqual(explicitNCF.cardBase,750);
assert.strictEqual(explicitNCF.groups.credito.monto,1000);
assert.strictEqual(explicitNCF.groups.consumo.monto,700);
assert.strictEqual(explicitConsolidated.overlapGross,826);
assert.strictEqual(explicitConsolidated.additionalGross,59);
assert.strictEqual(explicitConsolidated.consolidatedTotal,2065);

const withoutPayment=vm.runInContext(`process607(${JSON.stringify([
  {NCF:'E310000000001','Total Monto Facturado':1180,'ITBIS Facturado':180},
  {NCF:'E320000000001','Total Monto Facturado':590,'ITBIS Facturado':90},
])})`,context);
context.withoutPayment=withoutPayment;
vm.runInContext(`CARD_STATE.azul={totalSujetoRetencion:600,retenido:12};`,context);
const inferred=JSON.parse(vm.runInContext(`JSON.stringify(getIT1SalesBreakdown(withoutPayment.summary))`,context));
assert.strictEqual(inferred.payments.card,600);
assert.strictEqual(inferred.payments.cash,1770);
assert.strictEqual(inferred.total,2370);
assert.strictEqual(inferred.discrepancy,0);
vm.runInContext(`CARD_STATE.azul={baseGravable:600,totalSujetoRetencion:708,retenido:12};`,context);
const inferredNCF=JSON.parse(vm.runInContext(`JSON.stringify(getIT1NCFBreakdown(withoutPayment.summary))`,context));
assert.strictEqual(inferredNCF.groups.consumo.monto,500);

const inconsistent=vm.runInContext(`process607(${JSON.stringify([
  {NCF:'B01000000001','Total Monto Facturado':1000,'ITBIS Facturado':0,'Monto Facturado en Efectivo':700,'Monto Facturado en Tarjeta Debito Credito':500},
])})`,context);
context.inconsistent=inconsistent;
const inconsistentBreakdown=JSON.parse(vm.runInContext(`JSON.stringify(getIT1SalesBreakdown(inconsistent.summary))`,context));
assert.strictEqual(inconsistentBreakdown.discrepancy,-200);

const net607=vm.runInContext(`process607(${JSON.stringify([
  {NCF:'B02000000001','Total Monto Facturado':1000,'ITBIS Facturado':180,'Monto Facturado en Tarjeta Debito Credito':1180},
])})`,context);
context.net607=net607;
vm.runInContext(`CARD_STATE.azul=null;`,context);
const netBreakdown=JSON.parse(vm.runInContext(`JSON.stringify(getIT1SalesBreakdown(net607.summary))`,context));
assert.strictEqual(netBreakdown.total,1180);
assert.strictEqual(netBreakdown.payments.card,1180);
assert.strictEqual(netBreakdown.discrepancy,0);

const unknown=vm.runInContext(`process607(${JSON.stringify([
  {'Número de Comprobante Fiscal':'XYZ-123','Total Monto Facturado':100,'ITBIS Facturado':0},
])})`,context);
assert.strictEqual(unknown.summary.ncfGroups.otros.count,0);
assert.strictEqual(unknown.summary.ncfGroups.sinClasificar.count,1);

const credits=vm.runInContext(`process607(${JSON.stringify([
  {NCF:'B01000000001','Total Monto Facturado':1180,'Monto Gravado':1000,'ITBIS Facturado':180,'Monto Facturado en Efectivo':1180},
  {NCF:'B04000000001','Total Monto Facturado':236,'Monto Gravado':200,'ITBIS Facturado':36,'Monto Facturado en Efectivo':236},
])})`,context);
assert.strictEqual(credits.summary.totTotal,944);
assert.strictEqual(credits.summary.totGrav,800);
assert.strictEqual(credits.summary.totItbis,144);
assert.strictEqual(credits.summary.paymentSummary.cash,1180);
assert.strictEqual(credits.summary.ncfGroups.notaCredito.monto,200);

const ir2=vm.runInContext(`processIR2(${JSON.stringify([
  {Cuenta:'1001',Descripcion:'Caja','Débito':1000,'Crédito':0},
  {Cuenta:'1101',Descripcion:'Cuentas por cobrar','Débito':1000,'Crédito':0},
  {Cuenta:'2001',Descripcion:'Cuentas por pagar','Débito':0,'Crédito':400},
  {Cuenta:'3001',Descripcion:'Capital social','Débito':0,'Crédito':600},
  {Cuenta:'4001',Descripcion:'Ventas','Débito':0,'Crédito':2000},
  {Cuenta:'5001',Descripcion:'Costo de ventas','Débito':800,'Crédito':0},
  {Cuenta:'6001',Descripcion:'Gastos administrativos','Débito':200,'Crédito':0},
])})`,context);
assert.strictEqual(ir2.summary.ingresos,2000);
assert.strictEqual(ir2.summary.costos,800);
assert.strictEqual(ir2.summary.gastos,200);
assert.strictEqual(ir2.summary.utilidad,1000);
assert.strictEqual(ir2.summary.diferenciaBalance,0);
assert.strictEqual(ir2.summary.diferenciaEcuacion,0);
assert.strictEqual(ir2.summary.sinClasificar,0);
context.ir2=ir2;
document.getElementById('ir2-adiciones').value='100';
document.getElementById('ir2-deducciones').value='50';
document.getElementById('ir2-perdidas').value='200';
document.getElementById('ir2-anticipos').value='100';
const ir2Calc=JSON.parse(vm.runInContext(`JSON.stringify(getIR2Calculation(ir2.summary))`,context));
assert.strictEqual(ir2Calc.rentaImponible,850);
assert.strictEqual(ir2Calc.impuestoLiquidado,229.5);
assert.strictEqual(ir2Calc.resultado,129.5);

assert.match(code,/W28:pay\.cash,W29:pay\.transfer,W30:pay\.card,W31:pay\.credit,W32:pay\.bonds,W33:pay\.swap,W34:pay\.other/);
console.log('IT-1 logic: OK');
