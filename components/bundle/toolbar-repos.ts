import { Menu } from '@lumino/widgets';
import { h, VirtualElement } from '@lumino/virtualdom';

export class RepositoryMenuRenderer extends Menu.Renderer
{
	override renderLabel(data: Menu.IRenderData): VirtualElement
	{
		// Define the select styling object to reuse
		const selectStyle = {
			marginLeft: '5px',
			padding: '2px 4px',
			background: '#252526',
			color: '#ccc',
			border: '1px solid #3c3c3c'
		};

		if(data.item.command === 'select-owner-widget')
		{
			return h('select',
				{
					style: selectStyle,
					onchange: (e: Event) =>
					{
						const target = e.target as HTMLSelectElement;
						console.log('Owner changed to:', target.value);
					}
				},
				h('option', { value: 'org-1' }, 'Organization One'),
				h('option', { value: 'org-2' }, 'Organization Two')
			);
		}

		if(data.item.command === 'select-repo-widget')
		{
			return h('select',
				{
					style: selectStyle,
					onchange: (e: Event) =>
					{
						const target = e.target as HTMLSelectElement;
						console.log('Repo changed to:', target.value);
					}
				},
				h('option', { value: 'repo-a' }, 'Repository A'),
				h('option', { value: 'repo-b' }, 'Repository B')
			);
		}

		return h('span', {}, data.item.label);
	}
}


