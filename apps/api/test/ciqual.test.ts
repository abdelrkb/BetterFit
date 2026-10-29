import { describe, expect, it } from 'vitest';
import { decodeXml, parseAmount, parseFlatXml } from '../src/foods/ciqual.js';

/**
 * Un extrait fidèle au format publié par l'ANSES : une balise par
 * enregistrement, des champs d'un seul niveau, des nombres à virgule, et les
 * mentions textuelles de la table.
 */
const ALIM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<TABLE>
  <ALIM>
    <alim_grp_code>09</alim_grp_code>
    <alim_grp_nom_fr>produits c&#233;r&#233;aliers</alim_grp_nom_fr>
    <alim_ssgrp_nom_fr>p&#226;tes, riz et c&#233;r&#233;ales</alim_ssgrp_nom_fr>
    <alim_code>9644</alim_code>
    <alim_nom_fr>Riz blanc, cuit, non sal&#233;</alim_nom_fr>
  </ALIM>
  <ALIM>
    <alim_grp_code>36</alim_grp_code>
    <alim_grp_nom_fr>viandes</alim_grp_nom_fr>
    <alim_code>36018</alim_code>
    <alim_nom_fr>Blanc de poulet, r&#244;ti</alim_nom_fr>
  </ALIM>
</TABLE>`;

const CONST_XML = `<TABLE>
  <CONST><const_code>327</const_code><const_nom_fr>Energie, R&#232;glement UE N&#176; 1169/2011 (kcal/100 g)</const_nom_fr></CONST>
  <CONST><const_code>25000</const_code><const_nom_fr>Prot&#233;ines, N x facteur de Jones (g/100 g)</const_nom_fr></CONST>
  <CONST><const_code>31000</const_code><const_nom_fr>Glucides (g/100 g)</const_nom_fr></CONST>
</TABLE>`;

const COMPO_XML = `<TABLE>
  <COMPO><alim_code>9644</alim_code><const_code>327</const_code><teneur>130</teneur></COMPO>
  <COMPO><alim_code>9644</alim_code><const_code>25000</const_code><teneur>2,69</teneur></COMPO>
  <COMPO><alim_code>9644</alim_code><const_code>31000</const_code><teneur>&lt; 0,5</teneur></COMPO>
</TABLE>`;

describe('parseFlatXml', () => {
  it('lit les enregistrements et met les champs en minuscules', () => {
    const rows = parseFlatXml(ALIM_XML, 'ALIM');

    expect(rows).toHaveLength(2);
    expect(rows[0]?.alim_code).toBe('9644');
    expect(rows[1]?.alim_nom_fr).toBe('Blanc de poulet, rôti');
  });

  it('décode les entités, accents compris', () => {
    const rows = parseFlatXml(ALIM_XML, 'ALIM');

    expect(rows[0]?.alim_nom_fr).toBe('Riz blanc, cuit, non salé');
    expect(rows[0]?.alim_ssgrp_nom_fr).toBe('pâtes, riz et céréales');
  });

  it('accepte des enregistrements aux champs différents', () => {
    const rows = parseFlatXml(ALIM_XML, 'ALIM');

    // Le second aliment n'a pas de sous-groupe : ça ne doit pas décaler les
    // champs du premier.
    expect(rows[1]?.alim_ssgrp_nom_fr).toBeUndefined();
    expect(rows[1]?.alim_grp_nom_fr).toBe('viandes');
  });

  it('lit les constituants et les teneurs', () => {
    expect(parseFlatXml(CONST_XML, 'CONST')).toHaveLength(3);
    expect(parseFlatXml(COMPO_XML, 'COMPO')[2]?.teneur).toBe('< 0,5');
  });

  it('alerte si le format devient imbriqué', () => {
    const nested = '<TABLE><ALIM><a><b>x</b></a></ALIM></TABLE>';

    expect(() => parseFlatXml(nested, 'ALIM')).toThrow(/analyseur/);
  });
});

describe('parseAmount', () => {
  it('lit un nombre à virgule', () => {
    expect(parseAmount('2,69')).toBeCloseTo(2.69, 2);
    expect(parseAmount('130')).toBe(130);
  });

  it('compte « traces » comme zéro', () => {
    // Une quantité négligeable, pas une donnée manquante.
    expect(parseAmount('traces')).toBe(0);
    expect(parseAmount('Traces')).toBe(0);
  });

  it('laisse « non mesuré » à null', () => {
    // « - » veut dire qu'on ne sait pas. Le compter zéro fausserait les
    // totaux en faisant croire que l'aliment n'en contient pas.
    expect(parseAmount('-')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });

  it('retient la borne haute d’une valeur « inférieure à »', () => {
    expect(parseAmount('< 0,5')).toBeCloseTo(0.5, 2);
    expect(parseAmount('<0,1')).toBeCloseTo(0.1, 2);
  });

  it('ignore ce qu’il ne comprend pas', () => {
    expect(parseAmount('environ 12')).toBeNull();
  });

  it('supporte les espaces insécables de la table', () => {
    expect(parseAmount('< 0,5')).toBeCloseTo(0.5, 2);
  });
});

describe('le XML Ciqual n’est pas bien formé', () => {
  it('accepte un « < » non échappé dans une valeur', () => {
    // Quatre noms d'aliments de la table contiennent un « < » brut, par
    // exemple « Bière sans alcool (<1,2° alcool) ». Un analyseur XML strict
    // refuse le fichier entier ; le nôtre doit lire la valeur telle quelle.
    const xml =
      '<TABLE><ALIM><alim_code>1</alim_code>' +
      '<alim_nom_fr>Bière sans alcool (<1,2° alcool)</alim_nom_fr></ALIM></TABLE>';

    const rows = parseFlatXml(xml, 'ALIM');

    expect(rows[0]?.alim_nom_fr).toBe('Bière sans alcool (<1,2° alcool)');
  });

  it('refuse toujours une vraie balise imbriquée', () => {
    const xml = '<TABLE><ALIM><alim_nom_fr>Riz <b>blanc</b></alim_nom_fr></ALIM></TABLE>';

    expect(() => parseFlatXml(xml, 'ALIM')).toThrow(/analyseur/);
  });
});

describe('decodeXml', () => {
  it('lit un fichier déclaré en windows-1252', () => {
    // La table est publiée dans cet encodage, pas en UTF-8 : lue en UTF-8,
    // « Protéines » devient illisible et plus rien ne se cherche.
    const prolog = '<?xml version="1.0" encoding="windows-1252" ?>\n<TABLE>';
    const bytes = Buffer.concat([
      Buffer.from(prolog, 'latin1'),
      // « Protéines » en windows-1252 : le « é » tient sur un seul octet.
      Buffer.from([0x50, 0x72, 0x6f, 0x74, 0xe9, 0x69, 0x6e, 0x65, 0x73]),
      Buffer.from('</TABLE>', 'latin1'),
    ]);

    expect(decodeXml(bytes)).toContain('Protéines');
  });

  it('lit un fichier en UTF-8 quand c’est ce qu’il déclare', () => {
    const xml = '<?xml version="1.0" encoding="UTF-8" ?><TABLE>Protéines</TABLE>';

    expect(decodeXml(Buffer.from(xml, 'utf8'))).toContain('Protéines');
  });
});
