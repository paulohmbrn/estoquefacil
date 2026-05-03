// Data — Famiglia Reis Magos · Capim Macio · Sample inventory
// Subset curated from the real product list for prototype use.

const PRODUCTS = [
  // Proteínas - Bovinas
  { id: 'P0001', code: '1010101501500', name: 'Carne de Sol', brand: 'FRIBOI', group: 'Proteínas', subgroup: 'Bovinas', un: 'KG', qty: 4.367, validade: { resfriado: '3 dias', congelado: '90 dias' } },
  { id: 'P0002', code: '1010101502500', name: 'Filé Strogonoff 200g', brand: 'SWIFT', group: 'Proteínas', subgroup: 'Bovinas', un: 'UN', qty: 8 },
  { id: 'P0003', code: '1010101502701', name: 'Filé Parmegiana 150g', brand: 'SWIFT', group: 'Proteínas', subgroup: 'Bovinas', un: 'UN', qty: 31 },
  { id: 'P0004', code: '1010101503001', name: 'Carne Moída 200g', brand: 'FRIBOI', group: 'Proteínas', subgroup: 'Bovinas', un: 'UN', qty: 1 },
  { id: 'P0005', code: '1010101505100', name: 'Ragu de Carne', brand: 'Caseiro', group: 'Proteínas', subgroup: 'Bovinas', un: 'KG', qty: 0.6 },
  { id: 'P0006', code: '1010101500701', name: 'Carpaccio Completo 90g', brand: 'SWIFT', group: 'Proteínas', subgroup: 'Bovinas', un: 'UN', qty: 2 },
  // Aves
  { id: 'P0010', code: '1010100500100', name: 'Frango Desfiado', brand: 'Sadia', group: 'Proteínas', subgroup: 'Aves', un: 'KG', qty: 0.9 },
  // Frios e Embutidos
  { id: 'P0020', code: '1010102001500', name: 'Presunto Parma', brand: 'Sadia', group: 'Proteínas', subgroup: 'Frios', un: 'KG', qty: 0 },
  { id: 'P0021', code: '1010102002000', name: 'Presunto Cozido sem Capa', brand: 'Seara', group: 'Proteínas', subgroup: 'Frios', un: 'KG', qty: 1.297 },
  { id: 'P0022', code: '1010102002900', name: 'Presunto Royale 50g', brand: 'Sadia', group: 'Proteínas', subgroup: 'Frios', un: 'UN', qty: 0.5 },
  { id: 'P0023', code: '1010102500100', name: 'Bacon Fatiado', brand: 'Seara', group: 'Proteínas', subgroup: 'Frios', un: 'KG', qty: 2.583 },
  { id: 'P0024', code: '1010102500500', name: 'Linguiça Calabresa', brand: 'Aurora', group: 'Proteínas', subgroup: 'Frios', un: 'KG', qty: 0 },
  { id: 'P0025', code: '1010102501500', name: 'Linguiça Pepperoni', brand: 'Sadia', group: 'Proteínas', subgroup: 'Frios', un: 'KG', qty: 0.173 },
  // Frutos do mar
  { id: 'P0030', code: '1010104500100', name: 'Atum Triturado', brand: 'Frescatto', group: 'Proteínas', subgroup: 'Frutos do Mar', un: 'KG', qty: 0 },
  { id: 'P0031', code: '1010105500100', name: 'Camarão para Pizza', brand: 'Camanor', group: 'Proteínas', subgroup: 'Frutos do Mar', un: 'KG', qty: 6.456 },
  { id: 'P0032', code: '1010105500500', name: 'Camarão para Prato', brand: 'Camanor', group: 'Proteínas', subgroup: 'Frutos do Mar', un: 'KG', qty: 0.75 },
  // Massas Pizza
  { id: 'P0040', code: '1010500100100', name: 'Massa Pizza Trad. Gigante', brand: 'Caseira', group: 'Massas', subgroup: 'Pizza', un: 'UN', qty: 0 },
  { id: 'P0041', code: '1010500101000', name: 'Massa Pizza Trad. Grande', brand: 'Caseira', group: 'Massas', subgroup: 'Pizza', un: 'UN', qty: 0 },
  { id: 'P0042', code: '1010500101500', name: 'Massa Pizza Trad. Média', brand: 'Caseira', group: 'Massas', subgroup: 'Pizza', un: 'UN', qty: 14 },
  // Queijos
  { id: 'P0050', code: '1012001000100', name: 'Cream Cheese', brand: 'Polenghi', group: 'Queijos', subgroup: 'Frescos', un: 'KG', qty: 2.4 },
  { id: 'P0051', code: '1012001000200', name: 'Mussarela Fatiada', brand: 'Tirolez', group: 'Queijos', subgroup: 'Frescos', un: 'KG', qty: 28.5 },
  { id: 'P0052', code: '1012001000300', name: 'Parmesão Ralado', brand: 'Vigor', group: 'Queijos', subgroup: 'Frescos', un: 'KG', qty: 3.2 },
  { id: 'P0053', code: '1012001000400', name: 'Gorgonzola', brand: 'Tirolez', group: 'Queijos', subgroup: 'Especiais', un: 'KG', qty: 1.8 },
  { id: 'P0054', code: '1012001000500', name: 'Búfala', brand: 'Vigor', group: 'Queijos', subgroup: 'Especiais', un: 'KG', qty: 1.1 },
  { id: 'P0055', code: '1012001000600', name: 'Brie', brand: 'President', group: 'Queijos', subgroup: 'Especiais', un: 'KG', qty: 0.95 },
  // FLV
  { id: 'P0060', code: '1012500001000', name: 'Alecrim', brand: 'Sem marca', group: 'FLV', subgroup: 'Hortifruti', un: 'KG', qty: 0.18 },
  { id: 'P0061', code: '1012500001100', name: 'Manjericão Fresco', brand: 'Sem marca', group: 'FLV', subgroup: 'Hortifruti', un: 'KG', qty: 0.45 },
  { id: 'P0062', code: '1012500001200', name: 'Tomate Italiano', brand: 'CEASA', group: 'FLV', subgroup: 'Hortifruti', un: 'KG', qty: 8.6 },
  { id: 'P0063', code: '1012500001300', name: 'Cebola', brand: 'CEASA', group: 'FLV', subgroup: 'Hortifruti', un: 'KG', qty: 12.3 },
  { id: 'P0064', code: '1012501001000', name: 'Brócolis Congelado', brand: 'Bonduelle', group: 'FLV', subgroup: 'Congelados', un: 'KG', qty: 2.9 },
  { id: 'P0065', code: '1012502001000', name: 'Morango Congelado', brand: 'Bonduelle', group: 'FLV', subgroup: 'Congelados', un: 'KG', qty: 1.5 },
  // Molhos
  { id: 'P0070', code: '1011501001000', name: 'Molho de Tomate Pelado', brand: 'La Pastina', group: 'Molhos', subgroup: 'Italianos', un: 'KG', qty: 6.8 },
  { id: 'P0071', code: '1011501001100', name: 'Molho Alcaparra', brand: 'Caseiro', group: 'Molhos', subgroup: 'Especiais', un: 'KG', qty: 0.4 },
  { id: 'P0072', code: '1011501001200', name: 'Molho Pesto', brand: 'Caseiro', group: 'Molhos', subgroup: 'Especiais', un: 'KG', qty: 0.6 },
  // Secos
  { id: 'P0080', code: '1011500001000', name: 'Farinha Tipo 00', brand: 'Caputo', group: 'Secos', subgroup: 'Farinhas', un: 'KG', qty: 42.0 },
  { id: 'P0081', code: '1011500001100', name: 'Fermento Biológico', brand: 'Fleischmann', group: 'Secos', subgroup: 'Especiarias', un: 'KG', qty: 1.2 },
  { id: 'P0082', code: '1011500001200', name: 'Sal Refinado', brand: 'Cisne', group: 'Secos', subgroup: 'Especiarias', un: 'KG', qty: 5.5 },
  { id: 'P0083', code: '1011500001300', name: 'Erva Doce', brand: 'Sem marca', group: 'Secos', subgroup: 'Especiarias', un: 'KG', qty: 0.3 },
  { id: 'P0084', code: '1011502001000', name: 'Castanha Xerém', brand: 'Sem marca', group: 'Secos', subgroup: 'Castanhas', un: 'KG', qty: 0.8 },
  // Padaria
  { id: 'P0090', code: '1013500001000', name: 'Pão Crock', brand: 'Caseiro', group: 'Padaria', subgroup: 'Pães', un: 'KG', qty: 2.4 },
  // Bebidas
  { id: 'P0100', code: '1014000001000', name: 'Cachaça Dose', brand: 'Salinas', group: 'Bebidas', subgroup: 'Destilados', un: 'UN', qty: 24 },
  { id: 'P0101', code: '1014001001000', name: 'Café em Pó', brand: 'Pilão', group: 'Bebidas', subgroup: 'Café', un: 'KG', qty: 8.2 },
];

// Funcionários (referência: telas mobile mostram nomes)
const FUNCIONARIOS = [
  { id: 'F01', name: 'Ana Rita', role: 'Cozinha', tel: '(84) 9 9876-1010', perm: 'login', initials: 'AR' },
  { id: 'F02', name: 'Felipe',   role: 'Pizzaiolo', tel: '(84) 9 9876-1020', perm: 'sem-login', initials: 'F' },
  { id: 'F03', name: 'Joana',    role: 'Confeitaria', tel: '(84) 9 9876-1030', perm: 'login', initials: 'J' },
  { id: 'F04', name: 'João Vitor', role: 'Recebimento', tel: '(84) 9 9876-1040', perm: 'login', initials: 'JV' },
  { id: 'F05', name: 'Juliana',  role: 'Salão', tel: '(84) 9 9876-1050', perm: 'sem-login', initials: 'J' },
  { id: 'F06', name: 'Maria Eduarda', role: 'Cozinha', tel: '(84) 9 9876-1060', perm: 'login', initials: 'ME' },
  { id: 'F07', name: 'Mariana',  role: 'Caixa', tel: '(84) 9 9876-1070', perm: 'login', initials: 'M' },
  { id: 'F08', name: 'Matheus',  role: 'Pizzaiolo', tel: '(84) 9 9876-1080', perm: 'sem-login', initials: 'M' },
  { id: 'F09', name: 'Paulo F.', role: 'Gerente', tel: '(84) 9 9876-1090', perm: 'gestor', initials: 'PF' },
  { id: 'F10', name: 'Rafaela',  role: 'Cozinha', tel: '(84) 9 9876-1100', perm: 'login', initials: 'R' },
  { id: 'F11', name: 'Tiago',    role: 'Forno', tel: '(84) 9 9876-1110', perm: 'sem-login', initials: 'T' },
  { id: 'F12', name: 'Vitor',    role: 'Auxiliar', tel: '(84) 9 9876-1120', perm: 'sem-login', initials: 'V' },
];

const GRUPOS = [
  { id: 'G01', name: 'Proteínas',     icon: 'beef',     count: PRODUCTS.filter(p=>p.group==='Proteínas').length, color: '#aa0000' },
  { id: 'G02', name: 'Frutos do Mar', icon: 'fish',     count: PRODUCTS.filter(p=>p.subgroup==='Frutos do Mar').length, color: '#1e5b8a' },
  { id: 'G03', name: 'Queijos',       icon: 'cheese',   count: PRODUCTS.filter(p=>p.group==='Queijos').length, color: '#b8902e' },
  { id: 'G04', name: 'Massas',        icon: 'wheat',    count: PRODUCTS.filter(p=>p.group==='Massas').length, color: '#8a6a2e' },
  { id: 'G05', name: 'Molhos',        icon: 'bottle',   count: PRODUCTS.filter(p=>p.group==='Molhos').length, color: '#aa0000' },
  { id: 'G06', name: 'FLV',           icon: 'carrot',   count: PRODUCTS.filter(p=>p.group==='FLV').length, color: '#2d5a3a' },
  { id: 'G07', name: 'Secos',         icon: 'package',  count: PRODUCTS.filter(p=>p.group==='Secos').length, color: '#5a4a2a' },
  { id: 'G08', name: 'Confeitaria',   icon: 'cheese',   count: 0, color: '#b8902e' },
  { id: 'G09', name: 'Bebidas',       icon: 'bottle',   count: PRODUCTS.filter(p=>p.group==='Bebidas').length, color: '#004125' },
  { id: 'G10', name: 'Padaria',       icon: 'wheat',    count: PRODUCTS.filter(p=>p.group==='Padaria').length, color: '#8a6a2e' },
];

const LISTAS_CONTAGEM = [
  { id: 'L01', name: 'Proteínas', icon: 'beef', count: 14, tags: ['Proteínas - Carnes Bovinas', 'Proteínas - Aves'] },
  { id: 'L02', name: 'Peixes e Frutos do Mar', icon: 'fish', count: 3, tags: ['Proteínas - Frutos do Mar'] },
  { id: 'L03', name: 'Queijos', icon: 'cheese', count: 6, tags: ['Queijos - Frescos', 'Queijos - Especiais'] },
  { id: 'L04', name: 'Hortifruti', icon: 'carrot', count: 8, tags: ['FLV - Hortifruti'] },
  { id: 'L05', name: 'Massas e Molhos', icon: 'wheat', count: 7, tags: ['Massas - Pizza', 'Molhos - Italianos'] },
];

window.PRODUCTS = PRODUCTS;
window.FUNCIONARIOS = FUNCIONARIOS;
window.GRUPOS = GRUPOS;
window.LISTAS_CONTAGEM = LISTAS_CONTAGEM;
