import * as React from 'react';
import { Toggle, Stack } from '@fluentui/react';
import ReactEcharts from 'echarts-for-react';
import { EXPERIMENT, TRIALS } from '../../static/datamodel';
import { Trial } from '../../static/model/trial';
import { TooltipForAccuracy, EventMap } from '../../static/interface';
import { reformatRetiariiParameter } from '../../static/function';
import 'echarts/lib/chart/scatter';
import 'echarts/lib/component/tooltip';
import 'echarts/lib/component/title';

const EmptyGraph = {
    grid: {
        left: '8%'
    },
    xAxis: {
        name: 'Trial',
        type: 'category'
    },
    yAxis: {
        name: 'Default metric',
        type: 'value'
    }
};

interface DefaultPointProps {
    trialIds: string[];
    chartHeight: number;
    hasBestCurve: boolean;
    changeExpandRowIDs: Function;
}

interface DefaultPointState {
    bestCurveEnabled?: boolean | undefined;
    startY: number; // dataZoomY
    endY: number;
}

class DefaultPoint extends React.Component<DefaultPointProps, DefaultPointState> {
    constructor(props: DefaultPointProps) {
        super(props);
        this.state = {
            bestCurveEnabled: false,
            startY: 0, // dataZoomY
            endY: 100
        };
    }

    loadDefault = (ev: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
        this.setState({ bestCurveEnabled: checked });
    };

    metricDataZoom = (e: EventMap): void => {
        if (e.batch !== undefined) {
            this.setState(() => ({
                startY: e.batch[0].start !== null ? e.batch[0].start : 0,
                endY: e.batch[0].end !== null ? e.batch[0].end : 100
            }));
        }
    };

    pointClick = (params: any): void => {
        // [hasBestCurve: true]: is detail page, otherwise, is overview page
        const { hasBestCurve } = this.props;
        if (!hasBestCurve) {
            this.props.changeExpandRowIDs(params.data[2], 'chart');
        }
    };

    generateGraphConfig(_maxSequenceId: number): any {
        const { startY, endY } = this.state;
        const { hasBestCurve } = this.props;
        return {
            grid: {
                left: '8%'
            },
            tooltip: {
                trigger: 'item',
                enterable: hasBestCurve,
                confine: true, // confirm always show tooltip box rather than hidden by background
                formatter: (data: TooltipForAccuracy): React.ReactNode => `
                    <div class="tooldetailAccuracy">
                        <div>Trial No.: ${data.data[0]}</div>
                        <div>Trial ID: ${data.data[2]}</div>
                        <div>Default metric: ${data.data[1]}</div>
                        <div>Parameters: <pre>${JSON.stringify(
                            reformatRetiariiParameter(data.data[3]),
                            null,
                            4
                        )}</pre></div>
                    </div>
                `
            },
            dataZoom: [
                {
                    id: 'dataZoomY',
                    type: 'inside',
                    yAxisIndex: [0],
                    filterMode: 'empty',
                    start: startY,
                    end: endY
                }
            ],
            xAxis: {
                name: 'Trial',
                type: 'category'
            },
            yAxis: {
                name: 'Default metric',
                type: 'value',
                scale: true
            },
            series: undefined
        };
    }

    generateScatterSeries(trials: Trial[]): any {
        const data = trials.map(trial => [trial.sequenceId, trial.accuracy, trial.id, trial.description.parameters]);
        return {
            symbolSize: 6,
            type: 'scatter',
            data
        };
    }

    generateBestCurveSeries(trials: Trial[]): any {
        let best = trials[0];
        const data = [[best.sequenceId, best.accuracy, best.id, best.description.parameters]];

        for (let i = 1; i < trials.length; i++) {
            const trial = trials[i];
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const delta = trial.accuracy! - best.accuracy!;
            const better = EXPERIMENT.optimizeMode === 'minimize' ? delta < 0 : delta > 0;
            if (better) {
                data.push([trial.sequenceId, trial.accuracy, best.id, trial.description.parameters]);
                best = trial;
            } else {
                data.push([trial.sequenceId, best.accuracy, best.id, trial.description.parameters]);
            }
        }

        return {
            type: 'line',
            lineStyle: { color: '#FF6600' },
            data
        };
    }

    render(): React.ReactNode {
        const { hasBestCurve, chartHeight } = this.props;
        const graph = this.generateGraph();
        const accNodata = graph === EmptyGraph ? 'No data' : '';
        const onEvents = { dataZoom: this.metricDataZoom, click: this.pointClick };

        return (
            <div>
                {hasBestCurve && (
                    <Stack horizontalAlign='end' className='default-metric'>
                        <Toggle label='Optimization curve' inlineLabel onChange={this.loadDefault} />
                    </Stack>
                )}
                <div className='default-metric-graph graph'>
                    <ReactEcharts
                        option={graph}
                        style={{
                            width: '100%',
                            height: chartHeight,
                            margin: '0 auto'
                        }}
                        theme='nni_theme'
                        notMerge={true} // update now
                        onEvents={onEvents}
                    />
                    <div className='default-metric-noData'>{accNodata}</div>
                </div>
            </div>
        );
    }

    private generateGraph(): any {
        const trials = TRIALS.getTrials(this.props.trialIds).filter(trial => trial.sortable);
        if (trials.length === 0) {
            return EmptyGraph;
        }
        const graph = this.generateGraphConfig(trials[trials.length - 1].sequenceId);
        if (this.state.bestCurveEnabled) {
            (graph as any).series = [this.generateBestCurveSeries(trials), this.generateScatterSeries(trials)];
        } else {
            (graph as any).series = [this.generateScatterSeries(trials)];
        }
        return graph;
    }
}

export default DefaultPoint;
