import { html } from 'lit';
import {Task} from '@lit/task';
import { customElement, state } from 'lit/decorators.js';

import './subscription.lit.js';
import { OcelloidsElement } from '../base/ocelloids.lit.js';
import { tw } from '../style.js';
import { IconChevron, IconSpinner } from '../icons/index.js';

@customElement('oc-subscriptions')
export class Subscriptions extends OcelloidsElement {
  @state()
  private subscriptionId? : string;

  private _getSubscriptions = new Task(this, {
    task: async ([], {signal}) => {
      return await this.client.allSubscriptions({signal});
    },
    args: () => []
  });

  constructor() {
    super();
  }

  onSelected(e) {
    this.subscriptionId = e.target.value;
  }

  renderSelect(subscriptions) {
    return html`<div class=${tw`flex flex-col border-b border-gray-800`}>
    <div class=${tw`grid`}>
    ${IconChevron()}
    <select id="select-subscription" class=${tw`select-big`} @change=${this.onSelected}>
      <option selected disabled hidden>Select a subscription...</option>
      ${subscriptions.map(s => html`<option value=${s.id}>${s.id}</option>`)}
    </select>
  </div>
  </div>`;
  }

  renderSubscriptions(subscriptions) {
    return html`<div class=${tw`flex flex-col`}>
    ${this.renderSelect(subscriptions)}
    ${this.subscriptionId && html`
      <oc-subscription class=${tw`flex flex-col space-y-4 divide-y divide-gray-800`} id=${this.subscriptionId}>
      </oc-subscription>
    `}</div>`;
  }

  render() {
    return this._getSubscriptions.render({
      pending: () => html`<div class=${tw`flex items-center px-4`}>${IconSpinner()}</div>`,
      complete: (s) =>  this.renderSubscriptions(s),
      error: (e) => html`<div>error: ${e}</div>`
    });
  }
}