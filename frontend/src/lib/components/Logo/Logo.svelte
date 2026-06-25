<script lang="ts">
	import ciso from '$lib/assets/ciso.svg';

	interface Props {
		height?: number;
		width?: number;
	}

	let { height = 200, width = 200 }: Props = $props();
</script>

<img class="c" {height} {width} src={ciso} alt="Suricatoos" data-testid="logo-image" />
