const React = require('react');
const bugvaulty = require('../src');

class BugVaultyProvider extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			hasError: false,
		};

		this.hasInitialized = false;
	}

	componentDidMount() {
		this.initIfNeeded();
	}

	componentDidUpdate(prevProps) {
		if (prevProps.keys !== this.props.keys) {
			this.initIfNeeded();
		}
	}

	componentDidCatch(error, info) {
		this.setState({ hasError: true });

		try {
			bugvaulty.trackReactError(error, {
				source: 'reactErrorBoundary',
				componentStack: info && info.componentStack,
			});
		} catch (_err) {
			// Never crash host apps.
		}
	}

	initIfNeeded() {
		if (this.hasInitialized) {
			return;
		}

		try {
			if (this.props.keys) {
				bugvaulty.init(this.props.keys);
				this.hasInitialized = true;
			}
		} catch (_err) {
			// Never crash host apps.
		}
	}

	render() {
		if (this.state.hasError) {
			return React.createElement(
				'div',
				null,
				'Something went wrong. BugVaulty has logged this error.'
			);
		}

		return this.props.children;
	}
}

module.exports = {
	BugVaultyProvider,
};
