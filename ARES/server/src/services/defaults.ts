import { v4 as uuidv4 } from "uuid";
import type { DataSources, KnowledgeBase, Pod, UserProfile } from "../models/types.js";

export function getDefaultKnowledge(): KnowledgeBase {
  return {
    tableDictionary: [
      {
        tableName: "",
        description: ""
      }
    ],
    columnDictionary: [
      {
        tableName: "",
        columnName: "",
        dataType: "",
        description: "",
        filterable: false
      }
    ],
    parameters: {
      dateHandlingRules: "",
      bestQueryPractices: "",
      businessContext: "",
      sampleQueries: []
    },
    metrics: [
      {
        name: "",
        definition: "",
        sampleQuery: "",
        defaultFilters: ""
      }
    ]
  };
}

export function getDefaultSources(): DataSources {
  const now = new Date().toISOString();
  return {
    localSql: {
      connectionString: "",
      updatedAt: now
    },
    postgres: {
      connectionString: "",
      updatedAt: now
    },
    mysql: {
      connectionString: "",
      updatedAt: now
    },
    firebase: {
      projectId: "",
      serviceAccountJson: "",
      updatedAt: now
    }
  };
}

export function getDefaultProfile(): UserProfile {
  const now = new Date().toISOString();
  return {
    llmProvider: "OPENAI",
    apiKey: "",
    activeDataSource: "localSql",
    updatedAt: now
  };
}

export function createDefaultPod(name: string): Pod {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name,
    createdAt: now,
    knowledge: getDefaultKnowledge(),
    dataSources: getDefaultSources(),
    dashboards: [],
    knowledgeBank: [],
    insights: [],
    chatEnabled: true,
    chatOverride: false
  };
}
