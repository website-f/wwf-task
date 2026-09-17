/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Scroll Map — SharePoint Framework (SPFx) adapter
 *
 * "Web part" is SharePoint's word, and the assignment uses it, so this is the
 * adapter that closes the loop: the same core, in the CMS the vocabulary comes
 * from.
 *
 * SPFx web parts render into a DOM node rather than emitting a server-side
 * template, which is exactly the case core/scrollmap-render.js was written for.
 * The whole integration is: hold the content in web part properties, hand it to
 * the renderer, boot the engine.
 *
 *   properties (JSON, matches core/scrollmap.schema.json)
 *        → ScrollMapRender(content)   → markup
 *        → scrollmap.js               → behaviour
 *
 * Install:  copy core/scrollmap.css, core/scrollmap.js, core/scrollmap-render.js
 *           and core/vendor/ into ./assets/ and reference them from
 *           config/config.json as external scripts, or import them directly
 *           (they are UMD, so `import ScrollMapRender from './assets/scrollmap-render'`
 *           works once you add a .d.ts shim).
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Version } from '@microsoft/sp-core-library';
import {
  IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneToggle,
  PropertyPaneSlider,
  PropertyPaneButton,
  PropertyPaneButtonType
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { SPComponentLoader } from '@microsoft/sp-loader';

/* The content contract. Identical to core/scrollmap.schema.json — keep the two
   in step, or generate this interface from the schema with json-schema-to-typescript. */
export interface IImage { src: string; alt?: string; width?: number; height?: number; }
export interface IBox { x: number; y: number; w: number; h: number; }
export interface IHotspot {
  id?: string;
  label?: string;
  title?: string;
  text?: string;                       // p/br/em/strong/u/a only
  image?: IImage;
  caption?: string;
  side?: 'left' | 'right';
  box: IBox;                           // % of the map image
  zoom?: number;
  badge?: string;
  badgeLevel?: '' | 'least' | 'vulnerable' | 'endangered';
}
export interface IScrollMapContent {
  sectionTitle: string;
  leadText?: string;
  closingText?: string;
  map: IImage;
  hotspots: IHotspot[];
  options?: {
    focal?: { x: number; y: number };
    paws?: boolean; markers?: boolean; rail?: boolean;
    theme?: Record<string, string | number>;
  };
}

/* Web part properties. SharePoint persists these per instance, which is the
   direct equivalent of a Gutenberg block's attributes. */
export interface IScrollMapWebPartProps {
  sectionTitle: string;
  leadText: string;
  closingText: string;
  mapUrl: string;
  mapAlt: string;
  focalX: number;
  focalY: number;
  showPaws: boolean;
  showMarkers: boolean;
  showRail: boolean;
  /** The hotspot list, serialised. Edited through the custom pane below, not by
   *  hand — see openHotspotEditor(). */
  hotspotsJson: string;
}

declare const ScrollMapRender: {
  (content: IScrollMapContent): string;
  validate(content: unknown): { errors: string[]; warnings: string[]; ok: boolean };
};

export default class ScrollMapWebPart extends BaseClientSideWebPart<IScrollMapWebPartProps> {

  protected async onInit(): Promise<void> {
    // Load the core once per page. SPComponentLoader dedupes, so several
    // instances of the web part share one copy — the same guarantee the
    // WordPress adapter gets from wp_register_script().
    const base = this.context.pageContext.web.absoluteUrl + '/SiteAssets/scrollmap/';
    SPComponentLoader.loadCss(base + 'scrollmap.css');
    await SPComponentLoader.loadScript(base + 'vendor/gsap.min.js', { globalExportsName: 'gsap' });
    await SPComponentLoader.loadScript(base + 'vendor/ScrollTrigger.min.js', { globalExportsName: 'ScrollTrigger' });
    await SPComponentLoader.loadScript(base + 'scrollmap-render.js', { globalExportsName: 'ScrollMapRender' });
    await SPComponentLoader.loadScript(base + 'scrollmap.js');
    return super.onInit();
  }

  /** Web part properties → the schema object. This method IS the adapter. */
  private toContent(): IScrollMapContent {
    let hotspots: IHotspot[] = [];
    try {
      hotspots = JSON.parse(this.properties.hotspotsJson || '[]');
    } catch {
      hotspots = [];
    }
    return {
      sectionTitle: this.properties.sectionTitle || '',
      leadText: this.properties.leadText || '',
      closingText: this.properties.closingText || '',
      map: { src: this.properties.mapUrl, alt: this.properties.mapAlt || '' },
      hotspots,
      options: {
        focal: { x: this.properties.focalX ?? 50, y: this.properties.focalY ?? 50 },
        paws: this.properties.showPaws !== false,
        markers: this.properties.showMarkers !== false,
        rail: this.properties.showRail !== false
      }
    };
  }

  public render(): void {
    const content = this.toContent();
    const check = ScrollMapRender.validate(content);

    // In edit mode, show the author what is missing — the same list the
    // WordPress editor shows, from the same validate() function.
    if (!check.ok) {
      this.domElement.innerHTML =
        `<div style="padding:1rem;border:1px solid #d13438;background:#fdf3f4">
           <strong>Scroll Map — still to do:</strong>
           <ul>${check.errors.map(e => `<li>${e}</li>`).join('')}</ul>
         </div>`;
      return;
    }
    if (check.warnings.length) {
      console.warn('[scrollmap]', check.warnings);
    }

    this.domElement.innerHTML = ScrollMapRender(content);
    // scrollmap.js boots every [data-tgr] it finds, including ones added later.
    window.dispatchEvent(new Event('resize'));
  }

  protected get dataVersion(): Version { return Version.parse('1.0'); }

  /**
   * The property pane is SPFx's sidebar — the direct equivalent of Gutenberg's
   * InspectorControls, and it is organised into the brief's same four steps.
   *
   * Hotspots need a visual editor, not a JSON textarea. In a real build that is
   * a custom PropertyPaneField hosting the same canvas as the WordPress editor:
   * the draw / drag-to-move / drag-corner-to-resize code in
   * wp-plugin/wwf-scrollmap/editor.js is plain DOM and ports across unchanged.
   */
  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [{
        header: { description: 'A map with hotspots. The map zooms to each hotspot as the reader scrolls.' },
        groups: [
          {
            groupName: '1 · Section',
            groupFields: [
              PropertyPaneTextField('sectionTitle', {
                label: 'Section title', multiline: true, rows: 2,
                description: 'Required. The heading on the opening card. Enter = line break.'
              }),
              PropertyPaneTextField('leadText', {
                label: 'Lead text', multiline: true, rows: 5,
                description: 'The introduction. One paragraph per line.'
              }),
              PropertyPaneTextField('closingText', {
                label: 'Closing text (optional)', multiline: true, rows: 3
              })
            ]
          },
          {
            groupName: '2 · Map image',
            groupFields: [
              PropertyPaneTextField('mapUrl', { label: 'Map image URL' }),
              PropertyPaneTextField('mapAlt', { label: 'Alt text' })
            ]
          },
          {
            groupName: '3 · Hotspots',
            groupFields: [
              PropertyPaneButton('openHotspots', {
                text: 'Edit hotspots on the map',
                buttonType: PropertyPaneButtonType.Primary,
                onClick: () => this.openHotspotEditor()
              })
            ]
          },
          {
            groupName: 'Advanced',
            isCollapsed: true,
            groupFields: [
              PropertyPaneSlider('focalX', { label: 'Framing — horizontal', min: 0, max: 100 }),
              PropertyPaneSlider('focalY', { label: 'Framing — vertical', min: 0, max: 100 }),
              PropertyPaneToggle('showPaws', { label: 'Trail between hotspots' }),
              PropertyPaneToggle('showMarkers', { label: 'Numbered pins on the map' }),
              PropertyPaneToggle('showRail', { label: 'Jump-to bar' })
            ]
          }
        ]
      }]
    };
  }

  /** Opens the drawing canvas. Stub — wire to the ported editor canvas. */
  private openHotspotEditor(): string {
    // eslint-disable-next-line no-console
    console.info('Hotspot canvas: port the draw/move/resize handlers from wp-plugin editor.js');
    return this.properties.hotspotsJson;
  }
}

/*
 * PREVIEW BEFORE PUBLISHING — nothing to build. SharePoint pages have their own
 * Save-as-draft → Preview → Publish flow, and the web part renders identically
 * in edit, preview and published modes because render() is the only code path.
 */
