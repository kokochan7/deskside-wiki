import { useEffect, useState } from 'react';

// Minimal hash router: "#/clients/3" -> ["clients", "3"]
const read = () => window.location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);

export function useRoute() {
	const [parts, setParts] = useState(read);
	useEffect(() => {
		const on = () => {
			setParts(read());
			window.scrollTo(0, 0);
		};
		window.addEventListener('hashchange', on);
		return () => window.removeEventListener('hashchange', on);
	}, []);
	return parts;
}

export const navigate = (path: string) => {
	window.location.hash = path;
};

export const query = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '');
